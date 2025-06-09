import type { 
  Person, 
  DutyRecord, 
  DutySchedule, 
  TodayDuty, 
  DutyStats, 
  CalendarEvent,
  DutyRules,
  LeaveRecord,
  GenerateScheduleOptions,
  DutyActionResult
} from '../types';

// 默认排班规则
export const DEFAULT_RULES: DutyRules = {
  maxConsecutiveDays: 3,
  minRestDays: 1,
  excludeWeekends: false,
  excludeHolidays: false,
  fairnessWeight: 0.8
};

// 日期工具函数
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDate = (dateStr: string): Date => {
  return new Date(dateStr + 'T00:00:00');
};

export const addDays = (date: string, days: number): string => {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

export const getDaysBetween = (startDate: string, endDate: string): number => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

export const isWeekend = (date: string): boolean => {
  const d = parseDate(date);
  const day = d.getDay();
  return day === 0 || day === 6; // 周日=0, 周六=6
};

export const getDateRange = (startDate: string, days: number): string[] => {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(addDays(startDate, i));
  }
  return dates;
};

// 检查某人在特定日期是否请假
export const isPersonOnLeave = (personId: string, date: string, leaveRecords: LeaveRecord[]): boolean => {
  return leaveRecords.some(leave => 
    leave.personId === personId &&
    date >= leave.startDate &&
    date <= leave.endDate
  );
};

// 获取特定日期的排班记录
export const getDutyRecordByDate = (date: string, records: DutyRecord[]): DutyRecord | null => {
  return records.find(record => record.date === date) || null;
};

// 获取某人的排班统计
export const getPersonDutyStats = (personId: string, records: DutyRecord[], personName?: string): DutyStats => {
  const personRecords = records.filter(record => record.personId === personId);
  const dutyDates = personRecords.map(record => record.date).sort();
  
  // 计算连续值班天数
  let consecutiveDays = 0;
  const today = formatDate(new Date());
  let currentDate = today;
  
  while (true) {
    const record = getDutyRecordByDate(currentDate, records);
    if (record && record.personId === personId) {
      consecutiveDays++;
      currentDate = addDays(currentDate, -1);
    } else {
      break;
    }
  }

  // 优先使用传入的personName，否则从记录中查找
  const finalPersonName = personName || personRecords.find(r => r.personName)?.personName || '';
  
  return {
    personId,
    personName: finalPersonName,
    totalDuties: personRecords.length,
    dutyDates,
    consecutiveDays,
    lastDutyDate: dutyDates[dutyDates.length - 1]
  };
};

// 计算所有人的排班统计
export const getAllDutyStats = (people: Person[], records: DutyRecord[]): DutyStats[] => {
  return people.map(person => getPersonDutyStats(person.id, records, person.name));
};

// 检查排班是否违反规则
export const checkDutyConflicts = (
  personId: string, 
  date: string, 
  records: DutyRecord[],
  rules: DutyRules
): string[] => {
  const conflicts: string[] = [];
  
  // 检查连续值班天数
  let consecutiveDays = 1; // 包含当前这天
  let checkDate = addDays(date, -1);
  
  // 向前检查
  while (true) {
    const record = getDutyRecordByDate(checkDate, records);
    if (record && record.personId === personId) {
      consecutiveDays++;
      checkDate = addDays(checkDate, -1);
    } else {
      break;
    }
  }
  
  // 向后检查
  checkDate = addDays(date, 1);
  while (true) {
    const record = getDutyRecordByDate(checkDate, records);
    if (record && record.personId === personId) {
      consecutiveDays++;
      checkDate = addDays(checkDate, 1);
    } else {
      break;
    }
  }
  
  if (consecutiveDays > rules.maxConsecutiveDays) {
    conflicts.push(`连续值班天数超过限制 (${consecutiveDays}/${rules.maxConsecutiveDays})`);
  }
  
  // 检查最小休息天数
  const prevDate = addDays(date, -1);
  const nextDate = addDays(date, 1);
  
  const prevRecord = getDutyRecordByDate(prevDate, records);
  const nextRecord = getDutyRecordByDate(nextDate, records);
  
  if (prevRecord && prevRecord.personId === personId && rules.minRestDays > 0) {
    conflicts.push('违反最小休息天数要求');
  }
  
  if (nextRecord && nextRecord.personId === personId && rules.minRestDays > 0) {
    conflicts.push('违反最小休息天数要求');
  }
  
  return conflicts;
};

// 生成自动排班
export const generateAutoSchedule = (
  schedule: DutySchedule,
  options: GenerateScheduleOptions
): DutyRecord[] => {
  const { startDate, endDate, respectExisting } = options;
  const { people, rules, records, leaveRecords } = schedule;
  
  const activePeople = people.filter(p => p.isActive).sort((a, b) => a.order - b.order);
  if (activePeople.length === 0) return [];
  
  const dateRange = getDateRange(startDate, getDaysBetween(startDate, endDate) + 1);
  const newRecords: DutyRecord[] = [];
  
  // 如果需要保留现有记录，先添加它们
  if (respectExisting) {
    dateRange.forEach(date => {
      const existingRecord = getDutyRecordByDate(date, records);
      if (existingRecord && existingRecord.type !== 'auto') {
        newRecords.push(existingRecord);
      }
    });
  }
  
  // 为没有排班的日期分配值班人员
  dateRange.forEach(date => {
    // 跳过已有排班的日期
    if (newRecords.some(r => r.date === date)) return;
    
    // 跳过周末（如果规则要求）
    if (rules.excludeWeekends && isWeekend(date)) return;
    
    // 找到最合适的值班人员
    const availablePeople = activePeople.filter(person => 
      !isPersonOnLeave(person.id, date, leaveRecords)
    );
    
    if (availablePeople.length === 0) return;
    
    // 根据公平性选择值班人员
    const currentStats = getAllDutyStats(availablePeople, newRecords);
    const minDuties = Math.min(...currentStats.map(s => s.totalDuties));
    const candidates = currentStats.filter(s => s.totalDuties === minDuties);
    
    // 在候选人中选择第一个（按order排序）
    const selectedPerson = activePeople.find(p => 
      candidates.some(c => c.personId === p.id)
    );
    
    if (selectedPerson) {
      // 检查冲突
      const conflicts = checkDutyConflicts(selectedPerson.id, date, newRecords, rules);
      
      if (conflicts.length === 0 || !options.checkConflicts) {
        const record: DutyRecord = {
          id: `auto_${date}_${selectedPerson.id}`,
          date,
          personId: selectedPerson.id,
          personName: selectedPerson.name,
          type: 'auto',
          createdAt: new Date().toISOString()
        };
        newRecords.push(record);
      }
    }
  });
  
  return newRecords.sort((a, b) => a.date.localeCompare(b.date));
};

// 手动分配值班
export const assignManualDuty = (
  schedule: DutySchedule,
  date: string,
  personId: string,
  reason?: string
): DutyActionResult => {
  const person = schedule.people.find(p => p.id === personId);
  if (!person) {
    return { success: false, message: '找不到指定的人员' };
  }
  
  if (!person.isActive) {
    return { success: false, message: '该人员当前未参与排班' };
  }
  
  // 检查是否请假
  if (isPersonOnLeave(personId, date, schedule.leaveRecords)) {
    return { success: false, message: '该人员在此日期请假' };
  }
  
  // 检查冲突
  const conflicts = checkDutyConflicts(personId, date, schedule.records, schedule.rules);
  if (conflicts.length > 0) {
    return { 
      success: false, 
      message: `排班冲突: ${conflicts.join(', ')}`,
      conflictDates: [date]
    };
  }
  
  // 创建新记录
  const newRecord: DutyRecord = {
    id: `manual_${date}_${personId}_${Date.now()}`,
    date,
    personId,
    personName: person.name,
    type: 'manual',
    reason,
    createdAt: new Date().toISOString()
  };
  
  return {
    success: true,
    message: '手动分配成功',
    affectedRecords: [newRecord]
  };
};

// 换班操作
export const swapDuties = (
  schedule: DutySchedule,
  date1: string,
  date2: string,
  reason?: string
): DutyActionResult => {
  const activePeople = schedule.people.filter(p => p.isActive);
  if (activePeople.length === 0) {
    return { success: false, message: '没有可用的值班人员' };
  }
  
  const sortedPeople = [...activePeople].sort((a, b) => a.order - b.order);
  
  // 获取或生成第一个日期的排班信息
  let record1 = getDutyRecordByDate(date1, schedule.records);
  let person1: Person | undefined;
  
  if (!record1) {
    // 如果数据库中没有记录，使用轮转算法计算
    const daysSinceStart1 = Math.floor((parseDate(date1).getTime() - parseDate(schedule.startDate || formatDate(new Date())).getTime()) / (1000 * 60 * 60 * 24));
    const personIndex1 = daysSinceStart1 % sortedPeople.length;
    person1 = sortedPeople[personIndex1];
    
    // 创建虚拟记录
    record1 = {
      id: `auto_${date1}_${person1.id}`,
      date: date1,
      personId: person1.id,
      personName: person1.name,
      type: 'auto',
      createdAt: new Date().toISOString()
    };
  } else {
    person1 = schedule.people.find(p => p.id === record1?.personId);
  }
  
  // 获取或生成第二个日期的排班信息
  let record2 = getDutyRecordByDate(date2, schedule.records);
  let person2: Person | undefined;
  
  if (!record2) {
    // 如果数据库中没有记录，使用轮转算法计算
    const daysSinceStart2 = Math.floor((parseDate(date2).getTime() - parseDate(schedule.startDate || formatDate(new Date())).getTime()) / (1000 * 60 * 60 * 24));
    const personIndex2 = daysSinceStart2 % sortedPeople.length;
    person2 = sortedPeople[personIndex2];
    
    // 创建虚拟记录
    record2 = {
      id: `auto_${date2}_${person2.id}`,
      date: date2,
      personId: person2.id,
      personName: person2.name,
      type: 'auto',
      createdAt: new Date().toISOString()
    };
  } else {
    person2 = schedule.people.find(p => p.id === record2?.personId);
  }
  
  if (!person1 || !person2) {
    return { success: false, message: '找不到相关人员信息' };
  }
  
  // 如果是同一个人，不允许换班
  if (person1.id === person2.id) {
    return { success: false, message: '不能与自己换班' };
  }
  
  // 检查两个人在对方日期是否有冲突 - 确保personId不为null
  if (!record2.personId || !record1.personId) {
    return { success: false, message: '无法交换暂停的排班' };
  }
  
  const conflicts1 = checkDutyConflicts(record2.personId, date1, schedule.records, schedule.rules);
  const conflicts2 = checkDutyConflicts(record1.personId, date2, schedule.records, schedule.rules);
  
  if (conflicts1.length > 0 || conflicts2.length > 0) {
    return {
      success: false,
      message: `换班冲突: ${[...conflicts1, ...conflicts2].join(', ')}`,
      conflictDates: [date1, date2]
    };
  }
  
  // 创建换班记录
  const swapRecord1: DutyRecord = {
    id: `swap_${date1}_${record2.personId}_${Date.now()}`,
    date: date1,
    personId: record2.personId,
    personName: person2.name,
    type: 'swap',
    originalPersonId: record1.personId || undefined,
    reason,
    createdAt: new Date().toISOString()
  };
  
  const swapRecord2: DutyRecord = {
    id: `swap_${date2}_${record1.personId}_${Date.now()}`,
    date: date2,
    personId: record1.personId,
    personName: person1.name,
    type: 'swap',
    originalPersonId: record2.personId || undefined,
    reason,
    createdAt: new Date().toISOString()
  };
  
  return {
    success: true,
    message: `换班成功: ${person1.name}(${date1}) ↔ ${person2.name}(${date2})`,
    affectedRecords: [swapRecord1, swapRecord2]
  };
};

// 计算今日值班信息
export const calculateTodayDuty = (schedule: DutySchedule): TodayDuty => {
  const today = formatDate(new Date());
  const record = getDutyRecordByDate(today, schedule.records);
  
  if (!record) {
    return {
      date: today,
      person: null,
      record: null,
      isManualAssignment: false
    };
  }
  
  const person = schedule.people.find(p => p.id === record.personId);
  
  return {
    date: today,
    person: person || null,
    record,
    isManualAssignment: record.type === 'manual'
  };
};

// 生成日历事件数据
export const generateCalendarEvents = (
  schedule: DutySchedule,
  startDate: string,
  days: number
): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const today = formatDate(new Date());
  
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(parseDate(startDate));
    currentDate.setDate(currentDate.getDate() + i);
    const dateStr = formatDate(currentDate);
    
    // 查找该日期的排班记录 - 使用正确的字段名
    const dutyRecord = schedule.records.find(record => record.date === dateStr);
    
    let personId: string | null = null;
    let personName: string | null = null;
    let type: 'auto' | 'manual' | 'swap' | 'replacement' | 'suspended' = 'auto';
    let reason: string | undefined;
    
    if (dutyRecord) {
      personId = dutyRecord.personId;
      personName = dutyRecord.personName;
      type = dutyRecord.type;
      reason = dutyRecord.reason;
      
      // 如果不是暂停类型，查找对应的人员信息
      if (type !== 'suspended' && dutyRecord.personId) {
        const person = schedule.people.find(p => p.id === dutyRecord.personId);
        if (person) {
          personId = person.id;
          personName = person.name;
        } else {
          // 如果找不到对应人员，清空排班信息
          personId = null;
          personName = null;
        }
      }
    }
    
    events.push({
      id: dutyRecord?.id || `empty_${dateStr}`,
      date: dateStr,
      personId,
      personName,
      type,
      reason,
      isToday: dateStr === today,
      isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6,
      canEdit: true
    });
  }
  
  return events;
};

// 兼容旧版本的函数
export const generateSchedule = (people: Person[], startDate: string, days: number) => {
  const today = formatDate(new Date());
  const dateRange = getDateRange(startDate, days);
  
  return dateRange.map((date, index) => {
    const personIndex = index % people.length;
    const person = people[personIndex];
    
    return {
      date,
      person: person || null,
      dayOfWeek: parseDate(date).toLocaleDateString('zh-CN', { weekday: 'long' }),
      isToday: date === today
    };
  });
};

// 检查指定日期是否为暂停排班
export const isSuspendedDate = (date: string, records: DutyRecord[]): boolean => {
  const record = records.find(r => r.date === date);
  return record?.type === 'suspended';
};

// 生成唯一ID
const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 暂停指定日期的排班
export const suspendDutyForDate = (date: string, reason?: string): DutyRecord => {
  return {
    id: generateId(),
    date,
    personId: null,
    personName: null,
    type: 'suspended',
    reason: reason || '暂停排班',
    createdAt: new Date().toISOString(),
  };
};

// 恢复指定日期的排班（移除暂停记录）
export const resumeDutyForDate = (date: string, records: DutyRecord[]): DutyRecord[] => {
  return records.filter(record => !(record.date === date && record.type === 'suspended'));
};

// 批量暂停排班
export const suspendDutyForDateRange = (
  startDate: string, 
  endDate: string, 
  reason?: string
): DutyRecord[] => {
  const suspendedRecords: DutyRecord[] = [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = formatDate(date);
    suspendedRecords.push(suspendDutyForDate(dateStr, reason));
  }
  
  return suspendedRecords;
};

// 获取暂停日期列表
export const getSuspendedDates = (records: DutyRecord[]): string[] => {
  return records
    .filter(record => record.type === 'suspended')
    .map(record => record.date)
    .sort();
};

// 修改轮转算法，跳过暂停的日期
export const calculateRotationWithSuspension = (
  startDate: string,
  targetDate: string,
  people: Person[],
  records: DutyRecord[]
): Person | null => {
  // 如果目标日期被暂停，返回null
  if (isSuspendedDate(targetDate, records)) {
    return null;
  }
  
  const activePeople = people.filter(p => p.isActive).sort((a, b) => a.order - b.order);
  if (activePeople.length === 0) return null;
  
  // 计算从开始日期到目标日期（不包含）之间实际进行值班的天数
  // 这些天数决定了轮转的进度
  let dutyDayCount = 0;
  const start = parseDate(startDate);
  const target = parseDate(targetDate);
  
  // 从开始日期开始，逐日检查到目标日期（不包含目标日期）
  for (let date = new Date(start); date < target; date.setDate(date.getDate() + 1)) {
    const dateStr = formatDate(date);
    
    // 只有不被暂停的日期才会推进轮转计数
    if (!isSuspendedDate(dateStr, records)) {
      dutyDayCount++;
    }
  }
  
  // 轮转逻辑：
  // - 开始日期（第0天）分配给第0个人（索引0）
  // - 第1个有效值班日分配给第1个人（索引1）
  // - 以此类推，使用模运算处理循环
  const personIndex = dutyDayCount % activePeople.length;
  return activePeople[personIndex];
}; 