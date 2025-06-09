import React, { useState, useMemo } from 'react';
import type { DutySchedule, Person, CalendarEvent } from '../../types';
import { generateCalendarEvents, formatDate, parseDate, calculateRotationWithSuspension } from '../../utils/dutyCalculator';
import styles from './DutyCalendar.module.css';

interface DutyCalendarProps {
  schedule: DutySchedule;
  startDate: string; // 值班开始日期
  onAssignDuty: (date: string, personId: string) => void;
  onSwapDuties: (date1: string, date2: string) => void;
  onDeleteDuty: (date: string) => void;
  onBatchDeleteDuties: (dates: string[]) => void;
  onSuspendDuty: (date: string, reason?: string) => void; // 新增：暂停单个日期
  onBatchSuspendDuties: (dates: string[], reason?: string) => void; // 新增：批量暂停
  onResumeDuty: (date: string) => void; // 新增：恢复单个日期
  onShowDayDetail: (date: string) => void;
  onReplaceDuty: (date: string, personId: string, reason: string) => void;
}

type CalendarMode = 'confirmed' | 'preview';
type SchedulingMode = 'normal' | 'quickAssign'; // 新增快速排班模式
type DeleteMode = 'normal' | 'singleDelete' | 'batchDelete'; // 新增删除模式
type SuspendRangeMode = 'normal' | 'selectingRange'; // 新增暂停范围选择模式
type ReplacementMode = 'normal' | 'selectingDate'; // 新增替班模式

const DutyCalendar: React.FC<DutyCalendarProps> = ({
  schedule,
  startDate,
  onAssignDuty,
  onSwapDuties,
  onDeleteDuty,
  onBatchDeleteDuties,
  onSuspendDuty,
  onBatchSuspendDuties,
  onResumeDuty,
  onShowDayDetail,
  onReplaceDuty
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => formatDate(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapDate1, setSwapDate1] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('confirmed');
  // 新增状态 - 快速排班模式
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>('normal');
  const [selectedPersonForQuickAssign, setSelectedPersonForQuickAssign] = useState<string>('');
  // 新增：记录快速排班选中的日期
  const [selectedDatesForQuickAssign, setSelectedDatesForQuickAssign] = useState<string[]>([]);
  // 新增状态 - 删除模式
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('normal');
  const [selectedDatesForDelete, setSelectedDatesForDelete] = useState<string[]>([]);

  // 暂停范围选择模式状态
  const [suspendRangeMode, setSuspendRangeMode] = useState<SuspendRangeMode>('normal');
  const [suspendStartDate, setSuspendStartDate] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  // 换班相关状态
  // const [swapDate2, setSwapDate2] = useState<string | null>(null); // 暂时注释掉未使用的变量
  
  // 替班相关状态
  const [replacementDate, setReplacementDate] = useState<string | null>(null);
  const [selectedReplacementPerson, setSelectedReplacementPerson] = useState<string>('');
  const [replacementReason, setReplacementReason] = useState<string>('');
  const [replacementMode, setReplacementMode] = useState<ReplacementMode>('normal');

  // 计算当前月份的日历数据
  const calendarData = useMemo(() => {
    const firstDay = new Date(currentMonth.substring(0, 7) + '-01');
    const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0);
    const calendarStartDate = formatDate(new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstDay.getDay()));
    const calendarEndDate = formatDate(new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + (6 - lastDay.getDay())));
    
    const totalDays = Math.ceil((parseDate(calendarEndDate).getTime() - parseDate(calendarStartDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // 首先获取数据库中的排班记录
    const dbCalendarEvents = generateCalendarEvents(schedule, calendarStartDate, totalDays);
    
    // 如果是已排班模式，显示从startDate到今天+7天的确定排班
    if (calendarMode === 'confirmed') {
      const futureLimit = formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 今天+7天
      
      const activePeople = schedule.people.filter(p => p.isActive);
      const sortedPeople = [...activePeople].sort((a, b) => a.order - b.order);
      
      return dbCalendarEvents.map(dbEvent => {
        const currentDate = dbEvent.date;
        const isBeforeStartDate = currentDate < startDate;
        const isAfterFutureLimit = currentDate > futureLimit;
        
        // 在开始日期之前不显示任何排班
        if (isBeforeStartDate) {
          return {
            ...dbEvent,
            personId: '',
            personName: '',
            type: 'auto' as const
          };
        }
        
        // 如果数据库中有记录（包括暂停记录和手动记录），都显示
        if (dbEvent.personId || dbEvent.type === 'suspended') {
          return dbEvent;
        }
        
        // 超出未来7天限制的日期，如果没有手动记录，不显示自动排班
        if (isAfterFutureLimit) {
          return {
            ...dbEvent,
            personId: '',
            personName: '',
            type: 'auto' as const
          };
        }
        
        // 在有效范围内但没有数据库记录，使用轮转算法生成确定排班
        if (sortedPeople.length > 0) {
          // 使用新的轮转算法，考虑暂停日期
          const assignedPerson = calculateRotationWithSuspension(
            startDate,
            currentDate,
            schedule.people,
            schedule.records
          );
          
          // 验证分配的人员确实在当前活跃人员列表中
          if (assignedPerson && sortedPeople.some(p => p.id === assignedPerson.id)) {
            return {
              ...dbEvent,
              personId: assignedPerson.id,
              personName: assignedPerson.name,
              type: 'auto' as const
            };
          }
        }
        
        // 没有可用人员
        return {
          ...dbEvent,
          personId: '',
          personName: '',
          type: 'auto' as const
        };
      });
    }
    
    // 预览模式：显示完整的排班预览（包括轮转算法生成的）
    const activePeople = schedule.people.filter(p => p.isActive);
    
    if (activePeople.length === 0) {
      return dbCalendarEvents;
    }
    
    return dbCalendarEvents.map((dbEvent) => {
      const currentDate = dbEvent.date;
      const isBeforeStartDate = currentDate < startDate;
      
      if (isBeforeStartDate) {
        return {
          ...dbEvent,
          personId: '',
          personName: '',
          type: 'auto' as const
        };
      }
      
      // 如果数据库中有记录（包括暂停记录和手动记录），都显示
      if (dbEvent.personId || dbEvent.type === 'suspended') {
        return dbEvent;
      }
      
      // 使用轮转算法生成预览排班
      const assignedPerson = calculateRotationWithSuspension(
        startDate,
        currentDate,
        schedule.people,
        schedule.records
      );
      
      if (assignedPerson && activePeople.some(p => p.id === assignedPerson.id)) {
        return {
          ...dbEvent,
          personId: assignedPerson.id,
          personName: assignedPerson.name,
          type: 'auto' as const
        };
      }
      
      return dbEvent;
    });
  }, [schedule, currentMonth, startDate, calendarMode]);

  // 按周分组日历数据
  const weeks = useMemo(() => {
    const weeks: CalendarEvent[][] = [];
    for (let i = 0; i < calendarData.length; i += 7) {
      weeks.push(calendarData.slice(i, i + 7));
    }
    return weeks;
  }, [calendarData]);

  const navigateMonth = (direction: 1 | -1) => {
    const currentDate = parseDate(currentMonth);
    currentDate.setMonth(currentDate.getMonth() + direction);
    setCurrentMonth(formatDate(currentDate));
    // 重置选择状态
    setSelectedDate(null);
    setSwapMode(false);
    setSwapDate1(null);
    // 重置快速排班状态
    setSchedulingMode('normal');
    setSelectedPersonForQuickAssign('');
    setSelectedDatesForQuickAssign([]);
    // 重置删除模式状态
    setDeleteMode('normal');
    setSelectedDatesForDelete([]);
    // 重置暂停范围选择状态
    setSuspendRangeMode('normal');
    setSuspendStartDate(null);
    setSuspendReason('');
    // 重置替班模式状态
    setReplacementMode('normal');
    setReplacementDate(null);
    setSelectedReplacementPerson('');
    setReplacementReason('');
  };

  const handleDateClick = (event: CalendarEvent) => {
    // 预览模式下不允许任何编辑操作
    if (calendarMode === 'preview') {
      return;
    }

    // 暂停范围选择模式处理
    if (suspendRangeMode === 'selectingRange') {
      const today = formatDate(new Date());
      const clickedDate = event.date;
      
      // 允许选择今天和未来的日期
      if (clickedDate >= today) {
        if (!suspendStartDate) {
          // 第一次点击，记录第一个日期
          setSuspendStartDate(clickedDate);
        } else {
          // 第二次点击，自动判断起点和终点
          const firstDate = suspendStartDate;
          const secondDate = clickedDate;
          
          // 比较日期，早的作为起点，晚的作为终点
          const startDate = firstDate < secondDate ? firstDate : secondDate;
          const endDate = firstDate < secondDate ? secondDate : firstDate;
          
          // 生成范围内的所有日期
          const suspendDates: string[] = [];
          const start = parseDate(startDate);
          const end = parseDate(endDate);
          
          // 修复：创建新的Date对象避免修改原对象
          for (let currentDate = new Date(start.getTime()); currentDate <= end; currentDate.setDate(currentDate.getDate() + 1)) {
            suspendDates.push(formatDate(new Date(currentDate.getTime())));
          }
          
          // 执行暂停操作
          onBatchSuspendDuties(suspendDates, suspendReason || '范围暂停排班');
          
          // 重置状态
          setSuspendRangeMode('normal');
          setSuspendStartDate(null);
          setSuspendReason('');
        }
      }
      return;
    }

    // 删除模式处理
    if (deleteMode === 'singleDelete') {
      const today = formatDate(new Date());
      const clickedDate = event.date;
      
      // 只允许今天和未来有任何记录的日期进行删除（包括暂停记录）
      if (clickedDate >= today && (
        (event.personId && event.personId.trim() !== '') || 
        event.type === 'suspended'
      )) {
        onDeleteDuty(clickedDate);
        setDeleteMode('normal'); // 单次删除后退出删除模式
      }
      return;
    }

    if (deleteMode === 'batchDelete') {
      const today = formatDate(new Date());
      const clickedDate = event.date;
      
      // 只允许今天和未来有任何记录的日期进行删除（包括暂停记录）
      if (clickedDate >= today && (
        (event.personId && event.personId.trim() !== '') || 
        event.type === 'suspended'
      )) {
        setSelectedDatesForDelete(prev => {
          if (prev.includes(clickedDate)) {
            // 如果已选中，则取消选择
            return prev.filter(date => date !== clickedDate);
          } else {
            // 如果未选中，则添加到选中列表
            return [...prev, clickedDate];
          }
        });
      }
      return;
    }

    // 快速排班模式处理
    if (schedulingMode === 'quickAssign') {
      const today = formatDate(new Date());
      const clickedDate = event.date;
      
      // 只允许今天和未来的日期进行排班
      if (clickedDate < today) {
        return; // 过去的日期不能排班
      }
      
      // 如果选择了人员，则切换日期的选中状态
      if (selectedPersonForQuickAssign) {
        setSelectedDatesForQuickAssign(prev => {
          if (prev.includes(clickedDate)) {
            // 如果已选中，则取消选择
            return prev.filter(date => date !== clickedDate);
          } else {
            // 如果未选中，则添加到选中列表
            return [...prev, clickedDate];
          }
        });
      }
      return;
    }
    
    // 换班模式处理
    if (swapMode) {
      const today = formatDate(new Date());
      const clickedDate = event.date;
      
      // 只允许今天和未来的日期参与换班
      if (clickedDate < today) {
        return; // 过去的日期不能换班
      }
      
      if (!swapDate1) {
        // 只允许选择有值班人员且不是过去日期的日期作为换班源
        if (event.personId && event.personId.trim() !== '' && clickedDate >= today) {
          setSwapDate1(event.date);
        }
      } else if (swapDate1 !== event.date && event.personId && event.personId.trim() !== '' && clickedDate >= today) {
        // 执行换班操作
        onSwapDuties(swapDate1, event.date);
        setSwapMode(false);
        setSwapDate1(null);
      } else if (clickedDate >= today) {
        // 重新选择（只允许今天和未来的日期）
        setSwapDate1(event.personId && event.personId.trim() !== '' ? event.date : null);
      }
    }
    
    // 替班模式处理
    else if (replacementMode === 'selectingDate') {
      const today = formatDate(new Date());
      const clickedDate = event.date;
      
      // 只允许今天和未来有排班的日期进行替班
      if (clickedDate >= today && event.personId && event.personId.trim() !== '') {
        setReplacementDate(clickedDate);
      }
    }
    
    else {
      // 普通模式处理
      if (selectedDate === event.date) {
        setSelectedDate(null);
      } else {
        setSelectedDate(event.date);
      }
    }
  };

  const handlePersonAssign = (date: string, personId: string) => {
    onAssignDuty(date, personId);
    setSelectedDate(null);
  };

  const startSwapMode = () => {
    setSwapMode(true);
    setSwapDate1(null);
    setSelectedDate(null);
    // 退出快速排班模式
    setSchedulingMode('normal');
    setSelectedPersonForQuickAssign('');
    setSelectedDatesForQuickAssign([]);
  };

  const cancelSwapMode = () => {
    setSwapMode(false);
    setSwapDate1(null);
  };

  const isCurrentMonth = (date: string) => {
    return date.substring(0, 7) === currentMonth.substring(0, 7);
  };

  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];

  const currentDate = parseDate(currentMonth);
  const monthName = monthNames[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  // 新增：快速排班相关函数
  const startQuickAssignMode = () => {
    setSchedulingMode('quickAssign');
    setSwapMode(false);
    setSelectedDate(null);
    setSwapDate1(null);
  };

  const exitQuickAssignMode = () => {
    setSchedulingMode('normal');
    setSelectedPersonForQuickAssign('');
    setSelectedDatesForQuickAssign([]);
  };

  // 新增：确认快速排班
  const confirmQuickAssign = () => {
    if (selectedPersonForQuickAssign && selectedDatesForQuickAssign.length > 0) {
      // 批量执行排班操作
      selectedDatesForQuickAssign.forEach(date => {
        onAssignDuty(date, selectedPersonForQuickAssign);
      });
      // 清空选择
      setSelectedDatesForQuickAssign([]);
    }
  };

  // 新增：清空快速排班选择
  const clearQuickAssignSelection = () => {
    setSelectedDatesForQuickAssign([]);
  };

  // 新增：删除模式相关函数
  const startSingleDeleteMode = () => {
    setDeleteMode('singleDelete');
    setSwapMode(false);
    setSchedulingMode('normal');
    setSelectedDate(null);
    setSwapDate1(null);
    setSelectedPersonForQuickAssign('');
    setSelectedDatesForQuickAssign([]);
    setSelectedDatesForDelete([]);
  };

  const startBatchDeleteMode = () => {
    setDeleteMode('batchDelete');
    setSwapMode(false);
    setSchedulingMode('normal');
    setSelectedDate(null);
    setSwapDate1(null);
    setSelectedPersonForQuickAssign('');
    setSelectedDatesForQuickAssign([]);
    setSelectedDatesForDelete([]);
  };

  const exitDeleteMode = () => {
    setDeleteMode('normal');
    setSelectedDatesForDelete([]);
  };

  const confirmBatchDelete = () => {
    if (selectedDatesForDelete.length > 0) {
      onBatchDeleteDuties(selectedDatesForDelete);
      setSelectedDatesForDelete([]);
      setDeleteMode('normal');
    }
  };

  const clearDeleteSelection = () => {
    setSelectedDatesForDelete([]);
  };

  // 暂停范围选择相关函数
  const exitSuspendRangeMode = () => {
    setSuspendRangeMode('normal');
    setSuspendStartDate(null);
    setSuspendReason('');
  };

  // 替班相关函数
  const startReplacementMode = () => {
    setReplacementMode('selectingDate');
    setReplacementDate(null);
    setSelectedReplacementPerson('');
    setReplacementReason('');
  };

  const exitReplacementMode = () => {
    setReplacementMode('normal');
    setReplacementDate(null);
    setSelectedReplacementPerson('');
    setReplacementReason('');
  };

  const confirmReplacement = () => {
    if (!replacementDate || !selectedReplacementPerson) {
      return;
    }
    
    onReplaceDuty(replacementDate, selectedReplacementPerson, replacementReason);
    exitReplacementMode();
  };

  return (
    <div className={styles.dutyCalendar}>
      <div className={styles.header}>
        <h3>排班日历</h3>
        <div className={styles.navigation}>
          <button 
            onClick={() => navigateMonth(-1)}
            className={styles.navButton}
          >
            ‹ 上月
          </button>
          <span className={styles.monthYear}>
            {year}年{monthName}
          </span>
          <button 
            onClick={() => navigateMonth(1)}
            className={styles.navButton}
          >
            下月 ›
          </button>
        </div>
      </div>

      {/* 重新设计的操作工具栏 */}
      <div className={styles.toolbar}>
        {/* 顶部一行：左边操作按钮，右边模式切换 */}
        <div className={styles.topBar}>
          {/* 左侧：操作按钮 */}
          <div className={styles.leftActions}>
            {!swapMode && schedulingMode === 'normal' && deleteMode === 'normal' && replacementMode === 'normal' ? (
              <>
                {/* 统一操作菜单 */}
                <div 
                  className={styles.unifiedActionMenu}
                  data-disabled={calendarMode === 'preview'}
                >
                  <button 
                    className={`${styles.actionBtn} ${styles.unifiedBtn}`}
                    disabled={calendarMode === 'preview'}
                    title="操作选项"
                  >
                    <span className={styles.btnIcon}>⚙️</span>
                    <span className={styles.btnText}>操作</span>
                    <span className={styles.dropdownIcon}>▼</span>
                  </button>
                  <div className={styles.unifiedDropdownMenu}>
                    <button 
                      onClick={startSwapMode}
                      className={styles.dropdownItem}
                      disabled={schedule.people.filter(p => p.isActive).length < 2}
                    >
                      <span className={styles.dropdownIcon}>🔄</span>
                      <span>换班</span>
                    </button>
                    <button 
                      onClick={startReplacementMode}
                      className={styles.dropdownItem}
                      disabled={schedule.people.filter(p => p.isActive).length === 0}
                    >
                      <span className={styles.dropdownIcon}>🔀</span>
                      <span>替班</span>
                    </button>
                    <button 
                      onClick={startQuickAssignMode}
                      className={styles.dropdownItem}
                      disabled={schedule.people.filter(p => p.isActive).length === 0}
                    >
                      <span className={styles.dropdownIcon}>✨</span>
                      <span>快速排班</span>
                    </button>
                    <div className={styles.dropdownDivider}></div>
                    <button 
                      onClick={startSingleDeleteMode}
                      className={styles.dropdownItem}
                    >
                      <span className={styles.dropdownIcon}>🗑️</span>
                      <span>单个删除</span>
                    </button>
                    <button 
                      onClick={startBatchDeleteMode}
                      className={styles.dropdownItem}
                    >
                      <span className={styles.dropdownIcon}>📝</span>
                      <span>批量删除</span>
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* 右侧：模式切换 */}
          <div className={styles.rightModes}>
            <div className={styles.modeSwitch}>
              <button 
                className={`${styles.modeButton} ${calendarMode === 'confirmed' ? styles.active : ''}`}
                onClick={() => setCalendarMode('confirmed')}
              >
                <span className={styles.modeIcon}>📋</span>
                <span>已排班</span>
              </button>
              <button 
                className={`${styles.modeButton} ${calendarMode === 'preview' ? styles.active : ''}`}
                onClick={() => setCalendarMode('preview')}
              >
                <span className={styles.modeIcon}>👁️</span>
                <span>预览</span>
              </button>
            </div>
          </div>
        </div>

        {/* 活动状态显示区域 */}
        {(swapMode || schedulingMode !== 'normal' || deleteMode !== 'normal' || suspendRangeMode !== 'normal' || replacementMode !== 'normal') && (
          <div className={styles.activeStateArea}>
            {/* 活动状态显示 */}
            <div className={styles.activeMode}>
              {swapMode && (
                <div className={styles.modeIndicator}>
                  <span className={styles.modeIcon}>🔄</span>
                  <span className={styles.modeText}>
                    {!swapDate1 ? '选择第一个日期' : '选择第二个日期'}
                  </span>
                  <button onClick={cancelSwapMode} className={styles.exitBtn}>
                    ✕
                  </button>
                </div>
              )}

              {replacementMode !== 'normal' && (
                <div className={styles.replacementPanel}>
                  <div className={styles.modeIndicator}>
                    <span className={styles.modeIcon}>🔀</span>
                    <span className={styles.modeText}>
                      {!replacementDate ? '选择需要替班的日期' : '填写替班信息'}
                    </span>
                  </div>
                  
                  {replacementDate && (
                    <div className={styles.replacementInputs}>
                      <div className={styles.replacementDateInfo}>
                        <span>替班日期: {replacementDate}</span>
                      </div>
                      <select 
                        value={selectedReplacementPerson}
                        onChange={(e) => setSelectedReplacementPerson(e.target.value)}
                        className={styles.personSelector}
                      >
                        <option value="">选择替班人员</option>
                        {schedule.people.filter(p => p.isActive).map(person => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="替班原因（可选）"
                        value={replacementReason}
                        onChange={(e) => setReplacementReason(e.target.value)}
                        className={styles.reasonInput}
                      />
                    </div>
                  )}
                  
                  <div className={styles.replacementActions}>
                    {replacementDate && selectedReplacementPerson && (
                      <button onClick={confirmReplacement} className={styles.confirmBtn}>
                        确认替班
                      </button>
                    )}
                    <button onClick={exitReplacementMode} className={styles.exitBtn}>
                      取消
                    </button>
                  </div>
                </div>
              )}

              {schedulingMode === 'quickAssign' && (
                <div className={styles.quickAssignPanel}>
                  <div className={styles.personSelect}>
                    <span className={styles.selectLabel}>排班人员:</span>
                    <select 
                      value={selectedPersonForQuickAssign}
                      onChange={(e) => setSelectedPersonForQuickAssign(e.target.value)}
                      className={styles.personSelector}
                    >
                      <option value="">选择人员</option>
                      {schedule.people.filter(p => p.isActive).map(person => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className={styles.quickActions}>
                    {selectedDatesForQuickAssign.length > 0 && selectedPersonForQuickAssign && (
                      <button 
                        onClick={confirmQuickAssign} 
                        className={styles.confirmBtn}
                      >
                        确认 ({selectedDatesForQuickAssign.length})
                      </button>
                    )}
                    {selectedDatesForQuickAssign.length > 0 && (
                      <button onClick={clearQuickAssignSelection} className={styles.clearBtn}>
                        清空
                      </button>
                    )}
                    <button onClick={exitQuickAssignMode} className={styles.exitBtn}>
                      取消
                    </button>
                  </div>
                </div>
              )}

              {deleteMode !== 'normal' && (
                <div className={styles.deletePanel}>
                  <div className={styles.modeIndicator}>
                    <span className={styles.modeIcon}>🗑️</span>
                    <span className={styles.modeText}>
                      {deleteMode === 'singleDelete' ? '点击日期删除' : 
                       `已选择 ${selectedDatesForDelete.length} 个日期`}
                    </span>
                  </div>
                  
                  <div className={styles.deleteActions}>
                    {deleteMode === 'batchDelete' && selectedDatesForDelete.length > 0 && (
                      <>
                        <button onClick={confirmBatchDelete} className={styles.confirmDeleteBtn}>
                          删除 ({selectedDatesForDelete.length})
                        </button>
                        <button onClick={clearDeleteSelection} className={styles.clearBtn}>
                          清空
                        </button>
                      </>
                    )}
                    <button onClick={exitDeleteMode} className={styles.exitBtn}>
                      取消
                    </button>
                  </div>
                </div>
              )}

              {suspendRangeMode !== 'normal' && (
                <div className={styles.suspendPanel}>
                  <div className={styles.modeIndicator}>
                    <span className={styles.modeIcon}>⏸️</span>
                    <span className={styles.modeText}>
                      {suspendStartDate ? '选择第二个日期完成范围' : '选择第一个日期开始'}
                    </span>
                  </div>
                  
                  <div className={styles.suspendActions}>
                    <button onClick={exitSuspendRangeMode} className={styles.exitBtn}>
                      取消选择
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={styles.calendar}>
        <div className={styles.weekHeader}>
          {['日', '一', '二', '三', '四', '五', '六'].map(day => (
            <div key={day} className={styles.weekDay}>
              {day}
            </div>
          ))}
        </div>

        <div className={styles.calendarBody}>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className={styles.week}>
              {week.map((event) => {
                const today = formatDate(new Date());
                const isSwappable = swapMode && event.personId && event.personId.trim() !== '' && event.date >= today;
                const isQuickAssignable = schedulingMode === 'quickAssign' && event.date >= today && selectedPersonForQuickAssign;
                const isSelectedForQuickAssign = selectedDatesForQuickAssign.includes(event.date);
                const isDeletable = (deleteMode === 'singleDelete' || deleteMode === 'batchDelete') && event.date >= today && (
                  (event.personId && event.personId.trim() !== '') || 
                  event.type === 'suspended'
                );
                const isSelectedForDelete = selectedDatesForDelete.includes(event.date);
                const isSuspendable = (suspendRangeMode === 'selectingRange') && event.date >= today;
                const isSuspended = event.type === 'suspended';
                const isReplaceable = replacementMode === 'selectingDate' && event.personId && event.personId.trim() !== '' && event.date >= today;
                const isSelectedForReplacement = replacementDate === event.date;
                
                const isSuspendRangeStart = suspendStartDate === event.date;
                
                return (
                  <div
                    key={event.date}
                    className={`
                      ${styles.dayCell}
                      ${event.isToday ? styles.today : ''}
                      ${event.isWeekend ? styles.weekend : ''}
                      ${!isCurrentMonth(event.date) ? styles.otherMonth : ''}
                      ${calendarMode === 'preview' ? styles.previewMode : ''}
                      ${selectedDate === event.date ? styles.selected : ''}
                      ${swapMode && swapDate1 === event.date ? styles.swapSelected : ''}
                      ${isSwappable ? styles.swappable : ''}
                      ${isQuickAssignable ? styles.quickAssignable : ''}
                      ${isSelectedForQuickAssign ? styles.quickAssignSelected : ''}
                      ${schedulingMode === 'quickAssign' ? styles.quickAssignMode : ''}
                      ${isDeletable ? styles.deletable : ''}
                      ${isSelectedForDelete ? styles.deleteSelected : ''}
                      ${deleteMode !== 'normal' ? styles.deleteMode : ''}
                      ${isSuspendable ? styles.suspendable : ''}
                      ${isSuspended ? styles.suspended : ''}
                      ${isSuspendRangeStart ? styles.suspendRangeStart : ''}
                      ${suspendRangeMode === 'selectingRange' ? styles.suspendRangeMode : ''}
                      ${isReplaceable ? styles.replaceable : ''}
                      ${isSelectedForReplacement ? styles.replacementSelected : ''}
                      ${replacementMode !== 'normal' ? styles.replacementMode : ''}
                      ${event.personId && event.personId.trim() !== '' ? styles.hasDuty : styles.noDuty}
                    `}
                    onClick={() => handleDateClick(event)}
                  >
                    <div className={styles.dateNumber}>
                      {parseDate(event.date).getDate()}
                      {event.isToday && <span className={styles.todayBadge}>今日</span>}
                    </div>
                    
                    {isSuspended ? (
                      <div className={styles.suspendedInfo}>
                        <span className={styles.suspendedLabel}>
                          暂停
                        </span>
                      </div>
                    ) : event.personId && event.personId.trim() !== '' ? (
                      <div className={`${styles.dutyInfo} ${styles[event.type]}`}>
                        <span className={styles.personName}>
                          {event.personName}
                        </span>
                        {event.type !== 'auto' && (
                          <span className={styles.typeIndicator}>
                            {event.type === 'manual' ? '手动' : 
                             event.type === 'swap' ? '换班' : '替班'}
                          </span>
                        )}
                      </div>
                    ) : isCurrentMonth(event.date) ? (
                      <div className={styles.noDutyIndicator}>
                        无排班
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selectedDate && !swapMode && calendarMode === 'confirmed' && (
        <DayDetailPanel
          date={selectedDate}
          event={calendarData.find(e => e.date === selectedDate)}
          people={schedule.people.filter(p => p.isActive)}
          onAssignPerson={handlePersonAssign}
          onClose={() => setSelectedDate(null)}
          onShowDetail={onShowDayDetail}
          onSuspendDuty={onSuspendDuty}
          onResumeDuty={onResumeDuty}
          onStartSuspendRange={(startDate) => {
            setSuspendRangeMode('selectingRange');
            setSuspendStartDate(startDate);
          }}
        />
      )}

      <div className={styles.legend}>
        {/* 模式说明 */}
        <div className={styles.modeDescription}>
          {calendarMode === 'confirmed' ? (
            <div className={styles.modeInfo}>
              <span className={styles.modeIcon}>📋</span>
              <span>已排班模式：显示从开始日期到未来7天的确定排班（包括自动生成和手动调整）</span>
            </div>
          ) : (
            <div className={styles.modeInfo}>
              <span className={styles.modeIcon}>👁️</span>
              <span>预览模式：只读查看完整排班预览，包括更远未来的自动轮转排班</span>
            </div>
          )}
        </div>

        {/* 图例 */}
        <div className={styles.legendItems}>
          <div className={styles.legendItem}>
            <span className={`${styles.legendColor} ${styles.auto}`}></span>
            <span>自动排班</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendColor} ${styles.manual}`}></span>
            <span>手动分配</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendColor} ${styles.swap}`}></span>
            <span>换班</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendColor} ${styles.replacement}`}></span>
            <span>替班</span>
          </div>
        </div>
      </div>
      
      {swapMode && (
        <div className={styles.swapInstructions}>
          <p><strong>🔄 换班模式：</strong>选择两个有排班的日期进行交换</p>
        </div>
      )}

      {schedulingMode === 'quickAssign' && (
        <div className={styles.quickAssignInstructions}>
          <p><strong>✨ 快速排班：</strong>选择人员后点击日期批量排班</p>
        </div>
      )}

      {deleteMode !== 'normal' && (
        <div className={styles.deleteInstructions}>
          <p><strong>🗑️ 删除模式：</strong>
            {deleteMode === 'singleDelete' ? '点击日期直接删除' : '选择多个日期后批量删除'}
          </p>
        </div>
      )}

      {suspendRangeMode !== 'normal' && (
        <div className={styles.suspendInstructions}>
          <p><strong>⏸️ 暂停范围选择：</strong>
            {suspendStartDate ? '点击第二个日期完成范围选择（系统自动判断起始和结束日期）' : '点击第一个日期开始范围选择'}
          </p>
        </div>
      )}

      {replacementMode !== 'normal' && (
        <div className={styles.replacementInstructions}>
          <p><strong>🔀 替班模式：</strong>
            {!replacementDate ? '点击需要替班的日期，然后选择替班人员' : '选择替班人员并填写原因'}
          </p>
        </div>
      )}
    </div>
  );
};

// 日期详情面板组件
interface DayDetailPanelProps {
  date: string;
  event?: CalendarEvent;
  people: Person[];
  onAssignPerson: (date: string, personId: string) => void;
  onClose: () => void;
  onShowDetail: (date: string) => void;
  onSuspendDuty: (date: string, reason?: string) => void; // 新增：暂停功能
  onResumeDuty: (date: string) => void; // 新增：恢复功能
  onStartSuspendRange: (startDate: string) => void; // 新增：开始暂停范围选择
}

const DayDetailPanel: React.FC<DayDetailPanelProps> = ({
  date,
  event,
  people,
  onAssignPerson,
  onClose,
  onShowDetail,
  onSuspendDuty,
  onResumeDuty,
  onStartSuspendRange
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState('');

  const handleAssign = () => {
    if (selectedPersonId) {
      onAssignPerson(date, selectedPersonId);
    }
  };

  const dateObj = parseDate(date);
  const dateDisplay = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
  const weekDay = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][dateObj.getDay()];

  return (
    <div className={styles.dayDetailPanel}>
      <div className={styles.panelHeader}>
        <h4>{dateDisplay} {weekDay}</h4>
        <button onClick={onClose} className={styles.closeButton}>
          ×
        </button>
      </div>

      <div className={styles.panelBody}>
        {event?.personId && event.personId.trim() !== '' ? (
          <div className={styles.currentAssignment}>
            <p><strong>当前值班:</strong> {event.personName}</p>
            {event.type !== 'auto' && (
              <p><strong>分配方式:</strong> 
                {event.type === 'manual' ? '手动分配' : 
                 event.type === 'swap' ? '换班' : '替班'}
              </p>
            )}
            <button 
              onClick={() => onShowDetail(date)}
              className={styles.detailButton}
            >
              查看详情
            </button>
          </div>
        ) : (
          <p className={styles.noAssignment}>暂无排班</p>
        )}

        <div className={styles.reassignSection}>
          <h5>重新分配:</h5>
          <select 
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            className={styles.personSelect}
          >
            <option value="">选择人员</option>
            {people.map(person => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <button 
            onClick={handleAssign}
            disabled={!selectedPersonId}
            className={styles.assignButton}
          >
            分配
          </button>
        </div>

        {/* 新增：暂停相关操作 */}
        <div className={styles.suspendSection}>
          <h5>暂停排班:</h5>
          <div className={styles.suspendActions}>
            {event?.type === 'suspended' ? (
              <button 
                onClick={() => onResumeDuty(date)}
                className={styles.resumeButton}
              >
                🔄 恢复排班
              </button>
            ) : (
              <>
                <button 
                  onClick={() => onSuspendDuty(date, '单日暂停')}
                  className={styles.suspendButton}
                >
                  ⏸️ 暂停此日
                </button>
                <button 
                  onClick={() => {
                    onStartSuspendRange(date);
                    onClose(); // 关闭弹窗，进入范围选择模式
                  }}
                  className={styles.suspendRangeButton}
                >
                  📅 暂停范围选择
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DutyCalendar; 