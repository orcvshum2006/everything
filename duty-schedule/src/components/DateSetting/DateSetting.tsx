import { useRef } from 'react';
import styles from './DateSetting.module.css';

interface DateSettingProps {
  startDate: string;
  onUpdateStartDate: (date: string) => void;
}

const DateSetting: React.FC<DateSettingProps> = ({ startDate, onUpdateStartDate }) => {
  const dateInputRef = useRef<HTMLInputElement>(null);

  // 计算距离开始日期的天数
  const calculateDaysSince = () => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const today = new Date();
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysSince = calculateDaysSince();

  // 点击容器时聚焦到日期输入框
  const handleContainerClick = () => {
    if (dateInputRef.current) {
      dateInputRef.current.focus();
      dateInputRef.current.showPicker?.();
    }
  };

  // 格式化显示日期
  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '请选择日期';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <div className={styles.dateSetting}>
      <h3>📅 值班开始日期</h3>
      
      <div className={styles.dateInputWrapper}>
        <div 
          className={styles.dateInputContainer}
          onClick={handleContainerClick}
          title="点击选择日期"
        >
          <input
            ref={dateInputRef}
            type="date"
            value={startDate}
            onChange={(e) => onUpdateStartDate(e.target.value)}
            className={styles.dateInput}
            title="点击选择日期"
          />
          <span className={styles.dateIcon}>📅</span>
          <div className={styles.dateDisplay}>
            {formatDisplayDate(startDate)}
          </div>
        </div>
        
        {/* 状态显示 */}
        {startDate && (
          <div className={styles.statusCard}>
            <div className={styles.statusIcon}>⏰</div>
            <div className={styles.statusInfo}>
              <span className={styles.statusLabel}>距离开始日期</span>
              <span className={styles.statusValue}>
                {daysSince >= 0 ? `已过 ${daysSince} 天` : `还有 ${Math.abs(daysSince)} 天`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 帮助说明 */}
      <div className={styles.helpSection}>
        <div className={styles.helpTitle}>💡 设置说明</div>
        <div className={styles.helpContent}>
          <div className={styles.helpItem}>
            <span className={styles.helpIcon}>🎯</span>
            <span>设置值班轮班的开始日期</span>
          </div>
          <div className={styles.helpItem}>
            <span className={styles.helpIcon}>🔄</span>
            <span>系统会根据这个日期计算今天应该谁值班</span>
          </div>
          <div className={styles.helpItem}>
            <span className={styles.helpIcon}>📊</span>
            <span>调整日期会重新计算所有排班安排</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateSetting;