// 人员信息
export interface Person {
  id: string;
  name: string;
  order: number;
  isActive: boolean; // 是否参与排班
  email?: string; // 用于通知
  phone?: string;
}

// 排班记录
export interface DutyRecord {
  id: string;
  date: string; // YYYY-MM-DD 格式
  personId: string | null; // 暂停排班时为null
  personName: string | null; // 暂停排班时为null
  type: 'auto' | 'manual' | 'swap' | 'replacement' | 'suspended'; // 排班类型，新增suspended
  originalPersonId?: string; // 原本应该值班的人（换班/替班时使用）
  reason?: string; // 调整原因
  createdAt: string;
  createdBy?: string; // 操作人（将来支持多用户时使用）
}

// 换班申请
export interface SwapRequest {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
}

// 请假记录
export interface LeaveRecord {
  id: string;
  personId: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: 'sick' | 'vacation' | 'personal' | 'other';
  createdAt: string;
}

// 排班规则配置
export interface DutyRules {
  maxConsecutiveDays: number; // 最大连续值班天数
  minRestDays: number; // 最小休息天数
  excludeWeekends: boolean; // 是否排除周末
  excludeHolidays: boolean; // 是否排除节假日
  fairnessWeight: number; // 公平性权重 (0-1)
}

// 排班统计
export interface DutyStats {
  personId: string;
  personName: string;
  totalDuties: number; // 总值班次数
  dutyDates: string[]; // 值班日期列表
  consecutiveDays: number; // 当前连续值班天数
  lastDutyDate?: string; // 最后值班日期
}

// 日历事件（用于日历组件）
export interface CalendarEvent {
  id: string;
  date: string;
  personId: string | null; // 暂停排班时为null
  personName: string | null; // 暂停排班时为null
  type: DutyRecord['type'];
  reason?: string; // 新增：暂停原因等
  isToday: boolean;
  isWeekend: boolean;
  canEdit: boolean; // 是否可以编辑
}

// 主要的排班表数据结构
export interface DutySchedule {
  people: Person[];
  startDate: string;
  rules: DutyRules;
  records: DutyRecord[]; // 所有排班记录
  swapRequests: SwapRequest[]; // 换班申请
  leaveRecords: LeaveRecord[]; // 请假记录
  lastUpdated: string;
}

// 今日值班信息
export interface TodayDuty {
  date: string;
  person: Person | null;
  record: DutyRecord | null;
  isManualAssignment: boolean;
}

// 排班操作结果
export interface DutyActionResult {
  success: boolean;
  message: string;
  conflictDates?: string[]; // 冲突的日期
  affectedRecords?: DutyRecord[]; // 受影响的记录
}

// 排班生成选项
export interface GenerateScheduleOptions {
  startDate: string;
  endDate: string;
  respectExisting: boolean; // 是否保留现有的手动调整
  checkConflicts: boolean; // 是否检查冲突
} 