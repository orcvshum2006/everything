import React from 'react';
import type { TodayDuty } from '../../types';
import { formatDate } from '../../utils/dutyCalculator';
import styles from './SchedulePreview.module.css';

interface SchedulePreviewProps {
  schedule: TodayDuty[];
}

const SchedulePreview: React.FC<SchedulePreviewProps> = ({ schedule }) => {
  if (!schedule || schedule.length === 0) {
    return (
      <div className={styles.schedulePreview}>
        <h3>📋 未来排班预览</h3>
        <div className={styles.emptyMessage}>
          请添加值班人员并生成排班表
        </div>
      </div>
    );
  }

  return (
    <div className={styles.schedulePreview}>
      <h3>📋 未来排班预览</h3>
      <div className={styles.scheduleList}>
        {schedule.map((item, index) => {
          // 获取星期几
          const dayOfWeek = new Date(item.date).toLocaleDateString('zh-CN', { weekday: 'long' });
          const today = formatDate(new Date());
          const isToday = item.date === today;
          
          return (
            <div
              key={`${item.date}-${index}`}
              className={`${styles.scheduleItem} ${isToday ? styles.today : ''}`}
            >
              <div className={styles.scheduleDate}>
                <span className={styles.date}>{item.date}</span>
                <span className={styles.day}>{dayOfWeek}</span>
              </div>
              <div className={styles.schedulePerson}>
                {item.person ? (
                  <>
                    <span className={styles.personName}>{item.person.name}</span>
                    {isToday && <span className={styles.todayBadge}>今日</span>}
                  </>
                ) : item.record?.type === 'suspended' ? (
                  <span className={styles.suspended}>暂停</span>
                ) : (
                  <span className={styles.unassigned}>待分配</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SchedulePreview; 