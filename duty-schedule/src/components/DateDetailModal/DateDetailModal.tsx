import React, { useMemo } from 'react';
import type { DutySchedule } from '../../types';
import { formatDate, parseDate, getAllDutyStats } from '../../utils/dutyCalculator';
import styles from './DateDetailModal.module.css';

interface DateDetailModalProps {
  date: string;
  schedule: DutySchedule;
  onClose: () => void;
}

const DateDetailModal: React.FC<DateDetailModalProps> = ({ date, schedule, onClose }) => {
  const dateInfo = useMemo(() => {
    const dateObj = parseDate(date);
    const dateDisplay = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    const weekDay = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][dateObj.getDay()];
    const isToday = date === formatDate(new Date());
    
    // 查找当天的排班记录
    const record = schedule.records.find(r => r.date === date);
    const person = record ? schedule.people.find(p => p.id === record.personId) : null;
    
    // 如果没有记录，计算自动轮转结果
    let autoAssignedPerson = null;
    if (!record) {
      const activePeople = schedule.people.filter(p => p.isActive).sort((a, b) => a.order - b.order);
      if (activePeople.length > 0 && date >= schedule.startDate) {
        const daysSinceStart = Math.floor((parseDate(date).getTime() - parseDate(schedule.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const personIndex = daysSinceStart % activePeople.length;
        autoAssignedPerson = activePeople[personIndex];
      }
    }
    
    return {
      dateDisplay,
      weekDay,
      isToday,
      record,
      person,
      autoAssignedPerson
    };
  }, [date, schedule]);

  // 计算该人员的值班统计
  const personStats = useMemo(() => {
    if (!dateInfo.person && !dateInfo.autoAssignedPerson) return null;
    
    const targetPerson = dateInfo.person || dateInfo.autoAssignedPerson;
    const allStats = getAllDutyStats(schedule.people.filter(p => p.isActive), schedule.records);
    return allStats.find(stat => stat.personId === targetPerson?.id);
  }, [dateInfo, schedule]);

  // 计算轮转逻辑说明
  const rotationInfo = useMemo(() => {
    const activePeople = schedule.people.filter(p => p.isActive).sort((a, b) => a.order - b.order);
    if (activePeople.length === 0 || date < schedule.startDate) return null;
    
    const daysSinceStart = Math.floor((parseDate(date).getTime() - parseDate(schedule.startDate).getTime()) / (1000 * 60 * 60 * 24));
    const personIndex = daysSinceStart % activePeople.length;
    const expectedPerson = activePeople[personIndex];
    
    return {
      daysSinceStart: daysSinceStart + 1,
      totalPeople: activePeople.length,
      rotationCycle: Math.floor(daysSinceStart / activePeople.length) + 1,
      positionInCycle: (daysSinceStart % activePeople.length) + 1,
      expectedPerson
    };
  }, [date, schedule]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{dateInfo.dateDisplay} {dateInfo.weekDay}</h3>
          {dateInfo.isToday && <span className={styles.todayBadge}>今日</span>}
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {/* 当前排班信息 */}
          <div className={styles.section}>
            <h4>📅 排班信息</h4>
            {dateInfo.record ? (
              <div className={styles.assignmentInfo}>
                <div className={styles.personCard}>
                  <span className={styles.personName}>{dateInfo.person?.name || '已删除人员'}</span>
                  <span className={`${styles.typeTag} ${styles[dateInfo.record.type]}`}>
                    {dateInfo.record.type === 'manual' ? '手动分配' : 
                     dateInfo.record.type === 'swap' ? '换班' : 
                     dateInfo.record.type === 'replacement' ? '替班' : '自动轮转'}
                  </span>
                </div>
                {dateInfo.record.reason && (
                  <p className={styles.reason}><strong>原因：</strong>{dateInfo.record.reason}</p>
                )}
                <p className={styles.timestamp}>
                  <strong>创建时间：</strong>
                  {new Date(dateInfo.record.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
            ) : dateInfo.autoAssignedPerson ? (
              <div className={styles.assignmentInfo}>
                <div className={styles.personCard}>
                  <span className={styles.personName}>{dateInfo.autoAssignedPerson.name}</span>
                  <span className={`${styles.typeTag} ${styles.auto}`}>自动轮转</span>
                </div>
                <p className={styles.autoNote}>📋 此排班由系统自动轮转生成，未保存到数据库</p>
              </div>
            ) : (
              <p className={styles.noAssignment}>❌ 此日期暂无排班安排</p>
            )}
          </div>

          {/* 轮转逻辑说明 */}
          {rotationInfo && (
            <div className={styles.section}>
              <h4>🔄 轮转逻辑</h4>
              <div className={styles.rotationDetails}>
                <p><strong>值班开始：</strong>{schedule.startDate} 至今第 {rotationInfo.daysSinceStart} 天</p>
                <p><strong>轮转周期：</strong>第 {rotationInfo.rotationCycle} 轮，第 {rotationInfo.positionInCycle}/{rotationInfo.totalPeople} 位</p>
                <p><strong>预期人员：</strong>{rotationInfo.expectedPerson.name}</p>
                {dateInfo.record && dateInfo.person?.id !== rotationInfo.expectedPerson.id && (
                  <p className={styles.deviation}>
                    ⚠️ 实际排班与轮转预期不符（可能由于手动调整或换班）
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 人员统计 */}
          {personStats && (
            <div className={styles.section}>
              <h4>📊 个人统计</h4>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>总值班天数</span>
                  <span className={styles.statValue}>{personStats.totalDuties}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>最近值班</span>
                  <span className={styles.statValue}>
                    {personStats.lastDutyDate || '无记录'}
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>连续值班</span>
                  <span className={styles.statValue}>{personStats.consecutiveDays} 天</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>平均间隔</span>
                  <span className={styles.statValue}>暂不支持</span>
                </div>
              </div>
            </div>
          )}

          {/* 操作建议 */}
          <div className={styles.section}>
            <h4>💡 操作建议</h4>
            <div className={styles.suggestions}>
              <p>• 点击日历上的日期可以手动重新分配值班人员</p>
              <p>• 使用换班功能可以交换两个日期的值班安排</p>
              <p>• 在管理页面调整人员顺序会影响后续的自动轮转</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateDetailModal; 