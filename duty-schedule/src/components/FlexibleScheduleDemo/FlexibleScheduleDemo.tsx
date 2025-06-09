import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { formatDate, addDays } from '../../utils/dutyCalculator';
import type { DutySchedule } from '../../types';
import styles from './FlexibleScheduleDemo.module.css';

const FlexibleScheduleDemo: React.FC = () => {
  const [schedule, setSchedule] = useState<DutySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // 加载数据
  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const response = await apiService.getDutySchedule();
      if (response.success && response.data) {
        setSchedule(response.data);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    }
    setLoading(false);
  };

  // 初始化演示数据
  const initDemoData = async () => {
    const demoSchedule: DutySchedule = {
      people: [
        { id: '1', name: '张三', order: 1, isActive: true },
        { id: '2', name: '李四', order: 2, isActive: true },
        { id: '3', name: '王五', order: 3, isActive: true },
        { id: '4', name: '赵六', order: 4, isActive: true }
      ],
      startDate: formatDate(new Date()),
      rules: {
        maxConsecutiveDays: 3,
        minRestDays: 1,
        excludeWeekends: false,
        excludeHolidays: false,
        fairnessWeight: 0.8
      },
      records: [],
      swapRequests: [],
      leaveRecords: [],
      lastUpdated: new Date().toISOString()
    };

    try {
      const response = await apiService.updateDutySchedule(demoSchedule);
      if (response.success) {
        setSchedule(demoSchedule);
        setMessage('✅ 演示数据初始化成功！');
      }
    } catch (error) {
      setMessage('❌ 初始化失败');
    }
  };

  // 生成自动排班
  const generateAutoSchedule = async () => {
    if (!schedule) return;

    const startDate = formatDate(new Date());
    const endDate = addDays(startDate, 13); // 生成两周的排班

    try {
      setMessage('⏳ 正在生成自动排班...');
      const response = await apiService.generateSchedule(startDate, endDate, true);
      
      if (response.success) {
        await loadSchedule(); // 重新加载数据
        setMessage(`✅ 成功生成 ${response.data?.length || 0} 条排班记录`);
      } else {
        setMessage(`❌ 生成失败: ${response.error}`);
      }
    } catch (error) {
      setMessage('❌ 生成排班失败');
    }
  };

  // 手动分配排班
  const assignManualDuty = async (date: string, personId: string) => {
    if (!schedule) return;

    const person = schedule.people.find(p => p.id === personId);
    if (!person) return;

    try {
      const response = await apiService.addDutyRecord({
        date,
        personId,
        personName: person.name,
        type: 'manual',
        reason: '手动分配演示'
      });

      if (response.success) {
        await loadSchedule();
        setMessage(`✅ 已手动分配 ${person.name} 在 ${date} 值班`);
      } else {
        setMessage(`❌ 分配失败: ${response.error}`);
      }
    } catch (error) {
      setMessage('❌ 手动分配失败');
    }
  };

  // 换班操作
  const swapDuties = async (date1: string, date2: string) => {
    try {
      setMessage('⏳ 正在执行换班...');
      const response = await apiService.swapDuties(date1, date2, '演示换班操作');

      if (response.success) {
        await loadSchedule();
        setMessage(`✅ 换班成功: ${date1} ↔ ${date2}`);
      } else {
        setMessage(`❌ 换班失败: ${response.error}`);
      }
    } catch (error) {
      setMessage('❌ 换班操作失败');
    }
  };

  if (loading) {
    return <div className={styles.loading}>正在加载...</div>;
  }

  const today = formatDate(new Date());
  const nextWeek = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  
  return (
    <div className={styles.demoContainer}>
      <div className={styles.header}>
        <h2>🎯 灵活排班系统演示</h2>
        <p>展示手动分配、换班、自动排班等高级功能</p>
      </div>

      {message && (
        <div className={styles.message}>
          {message}
        </div>
      )}

      <div className={styles.actions}>
        <button onClick={initDemoData} className={styles.button}>
          🚀 初始化演示数据
        </button>
        <button 
          onClick={generateAutoSchedule} 
          className={styles.button}
          disabled={!schedule || schedule.people.length === 0}
        >
          🤖 生成自动排班
        </button>
      </div>

      {schedule && (
        <>
          <div className={styles.section}>
            <h3>👥 值班人员</h3>
            <div className={styles.peopleList}>
              {schedule.people.map(person => (
                <div key={person.id} className={styles.personCard}>
                  <span className={styles.personName}>{person.name}</span>
                  <span className={`${styles.status} ${person.isActive ? styles.active : styles.inactive}`}>
                    {person.isActive ? '参与' : '暂停'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h3>📅 本周排班</h3>
            <div className={styles.scheduleGrid}>
              {nextWeek.map((date) => {
                const record = schedule.records.find(r => r.date === date);
                const isToday = date === today;
                
                return (
                  <div key={date} className={`${styles.dayCard} ${isToday ? styles.today : ''}`}>
                    <div className={styles.dateHeader}>
                      <span className={styles.date}>
                        {new Date(date + 'T00:00:00').getDate()}日
                      </span>
                      <span className={styles.weekday}>
                        {['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(date + 'T00:00:00').getDay()]}
                      </span>
                    </div>
                    
                    {record ? (
                      <div className={`${styles.dutyInfo} ${styles[record.type]}`}>
                        <span className={styles.personName}>{record.personName}</span>
                        <span className={styles.dutyType}>
                          {record.type === 'auto' ? '自动' : 
                           record.type === 'manual' ? '手动' : 
                           record.type === 'swap' ? '换班' : '替班'}
                        </span>
                      </div>
                    ) : (
                      <div className={styles.noDuty}>
                        <span>无排班</span>
                      </div>
                    )}

                    <div className={styles.dayActions}>
                      <select 
                        onChange={(e) => {
                          if (e.target.value) {
                            assignManualDuty(date, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className={styles.assignSelect}
                      >
                        <option value="">手动分配</option>
                        {schedule.people.filter(p => p.isActive).map(person => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.section}>
            <h3>🔄 换班演示</h3>
            <p>点击两个已有排班的日期进行换班：</p>
            <div className={styles.swapDemo}>
              {schedule.records.slice(0, 4).map((record, index) => (
                <button
                  key={record.id}
                  onClick={() => {
                    if (index < schedule.records.length - 1) {
                      const nextRecord = schedule.records[index + 1];
                      swapDuties(record.date, nextRecord.date);
                    }
                  }}
                  className={styles.swapButton}
                  disabled={index >= schedule.records.length - 1}
                >
                  {record.date}: {record.personName}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h3>📊 排班统计</h3>
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{schedule.people.filter(p => p.isActive).length}</span>
                <span className={styles.statLabel}>参与人数</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{schedule.records.length}</span>
                <span className={styles.statLabel}>排班记录</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>
                  {schedule.records.filter(r => r.type === 'manual').length}
                </span>
                <span className={styles.statLabel}>手动分配</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>
                  {schedule.records.filter(r => r.type === 'swap').length}
                </span>
                <span className={styles.statLabel}>换班记录</span>
              </div>
            </div>
          </div>
        </>
      )}

      <div className={styles.features}>
        <h3>✨ 新功能亮点</h3>
        <div className={styles.featureList}>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🎯</span>
            <div className={styles.featureText}>
              <strong>手动分配</strong>
              <p>可以为任意日期手动指定值班人员，覆盖自动排班</p>
            </div>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🔄</span>
            <div className={styles.featureText}>
              <strong>换班功能</strong>
              <p>支持任意两个日期的值班人员互换，记录换班原因</p>
            </div>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🤖</span>
            <div className={styles.featureText}>
              <strong>智能排班</strong>
              <p>自动生成排班的同时保留已有的手动调整</p>
            </div>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>📊</span>
            <div className={styles.featureText}>
              <strong>公平性分析</strong>
              <p>统计每人值班次数，确保排班公平合理</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlexibleScheduleDemo; 