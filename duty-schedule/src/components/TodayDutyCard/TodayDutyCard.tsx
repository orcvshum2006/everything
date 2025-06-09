import React from 'react';
import type { TodayDuty } from '../../types';
import styles from './TodayDutyCard.module.css';

interface TodayDutyCardProps {
  todayDuty: TodayDuty;
}

const TodayDutyCard: React.FC<TodayDutyCardProps> = ({ todayDuty }) => {
  // 获取今天是星期几
  const today = new Date(todayDuty.date);
  const dayOfWeek = today.toLocaleDateString('zh-CN', { weekday: 'long' });
  
  return (
    <div className={`${styles.todayDutyCard} ${!todayDuty.person ? styles.empty : ''}`}>
      <h2>📅 今日值班</h2>
      <div className={styles.dutyInfo}>
        <div className={styles.dateInfo}>
          <span className={styles.date}>{todayDuty.date}</span>
          <span className={styles.day}>{dayOfWeek}</span>
        </div>
        {todayDuty.person ? (
          <div className={styles.personInfo}>
            <span className={styles.personName}>{todayDuty.person.name}</span>
            <span className={styles.dutyText}>值班中</span>
          </div>
        ) : (
          <div className={styles.personInfo}>
            <span className={styles.personName}>暂无安排</span>
            <span className={styles.dutyText}>请添加人员并生成排班</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayDutyCard; 