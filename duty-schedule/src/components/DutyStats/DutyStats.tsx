import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Legend } from 'recharts';
import type { DutySchedule } from '../../types';
import { formatDate, parseDate, getDateRange, calculateRotationWithSuspension } from '../../utils/dutyCalculator';
import styles from './DutyStats.module.css';

interface DutyStatsProps {
  schedule: DutySchedule;
}

const DutyStats: React.FC<DutyStatsProps> = ({ schedule }) => {
  const [chartView, setChartView] = useState(false); // 控制图表/列表视图切换

  // 只统计从开始日期之后，且在今天之前的值班记录（已完成的值班）
  const today = formatDate(new Date());
  const startDate = schedule.startDate;
  
  // 获取所有活跃人员
  const activePeople = schedule.people.filter(p => p.isActive);
  
  // 计算应该统计的日期范围（从开始日期到昨天）
  const daysSinceStart = Math.floor((parseDate(today).getTime() - parseDate(startDate).getTime()) / (1000 * 60 * 60 * 24));
  
  // 使用useMemo缓存未来排班统计，避免重复计算
  const futureScheduleStats = useMemo(() => {
    console.log('=== 未来排班统计调试 ===');
    console.log('今日:', today);
    console.log('排班开始日期:', startDate);
    console.log('活跃人员:', activePeople.map(p => p.name));
    console.log('所有排班记录:', schedule.records);
    
    // 正确模仿"已排班"视图逻辑：手动记录无限制，轮转算法只在7天内，连续7天无排班时停止
    const futureLimit = formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 今天+7天（仅用于轮转算法）
    const actualDutyDates: { date: string; personId: string; personName: string }[] = [];
    let currentDateToCheck = today;
    let consecutiveNoAssignmentDays = 0;
    const maxConsecutiveNoAssignmentDays = 7; // 连续7天无排班时停止
    
    // 持续检测直到连续7天无排班
    while (consecutiveNoAssignmentDays < maxConsecutiveNoAssignmentDays) {
      let hasAssignment = false;
      let isTruelyNoSchedule = false; // 区分"暂停"和真正的"无排班"
      
      // 在开始日期之前不显示任何排班
      if (currentDateToCheck < startDate) {
        console.log(`❌ ${currentDateToCheck} 在开始日期之前，显示为"无排班"`);
        isTruelyNoSchedule = true;
      } else {
        // 检查是否有数据库记录（包括暂停记录和手动记录）
        const dbRecord = schedule.records.find(record => record.date === currentDateToCheck);
        
        if (dbRecord) {
          if (dbRecord.type === 'suspended') {
            console.log(`🚫 ${currentDateToCheck} 是暂停日期，不计入统计，但不算"无排班"`);
            // 暂停不计入统计，但也不算无排班，不影响连续计数
          } else if (dbRecord.personId && dbRecord.personName) {
            console.log(`✅ ${currentDateToCheck} 有数据库记录，显示为 ${dbRecord.personName}`);
            actualDutyDates.push({ 
              date: currentDateToCheck, 
              personId: dbRecord.personId,
              personName: dbRecord.personName
            });
            hasAssignment = true;
          }
        } else {
          // 没有数据库记录，只在7天范围内使用轮转算法生成排班
          if (currentDateToCheck <= futureLimit && activePeople.length > 0) {
            const assignedPerson = calculateRotationWithSuspension(
              startDate,
              currentDateToCheck,
              activePeople,
              schedule.records
            );
            
            // 验证分配的人员确实在当前活跃人员列表中
            if (assignedPerson && activePeople.some(p => p.id === assignedPerson.id)) {
              console.log(`✅ ${currentDateToCheck} 轮转分配（7天内），显示为 ${assignedPerson.name}`);
              actualDutyDates.push({ 
                date: currentDateToCheck, 
                personId: assignedPerson.id,
                personName: assignedPerson.name
              });
              hasAssignment = true;
            } else {
              console.log(`❌ ${currentDateToCheck} 轮转算法无法分配，真正的"无排班"`);
              isTruelyNoSchedule = true;
            }
          } else {
            console.log(`❌ ${currentDateToCheck} 超出7天范围且无手动记录，真正的"无排班"`);
            isTruelyNoSchedule = true;
          }
        }
      }
      
      // 更新连续无排班天数计数（只有真正的"无排班"才计数）
      if (hasAssignment || (!hasAssignment && !isTruelyNoSchedule)) {
        // 有排班 或者 是暂停（不是真正无排班）
        consecutiveNoAssignmentDays = 0; // 重置计数
      } else if (isTruelyNoSchedule) {
        // 真正的无排班
        consecutiveNoAssignmentDays++;
      }
      
      // 移动到下一天
      const nextDate = new Date(parseDate(currentDateToCheck).getTime() + 24 * 60 * 60 * 1000);
      currentDateToCheck = formatDate(nextDate);
    }
    
    console.log('未来有具体人员的排班日期:', actualDutyDates);
    console.log(`统计结束条件: 连续${maxConsecutiveNoAssignmentDays}天真正"无排班"（暂停不算无排班）`);
    console.log(`最后检查日期: ${formatDate(new Date(parseDate(currentDateToCheck).getTime() - 24 * 60 * 60 * 1000))}`);
    
    const futureStats = activePeople.map(person => {
      const personFutureRecords = actualDutyDates.filter(duty => duty.personId === person.id);
      const confirmedDates = personFutureRecords.map(duty => duty.date).sort();
      
      console.log(`${person.name} (ID: ${person.id}) 的未来排班记录:`, personFutureRecords.length, '天', confirmedDates);
      
      return {
        personId: person.id,
        personName: person.name,
        confirmedDuties: personFutureRecords.length,
        confirmedDates
      };
    });

    const totalFutureDuties = actualDutyDates.length;
    
    console.log('未来已排班天数（与日历"已排班"视图一致）:', totalFutureDuties);

    return { futureStats, totalFutureDuties };
  }, [schedule, today, startDate, activePeople]);

  const { futureStats, totalFutureDuties } = futureScheduleStats;

  if (daysSinceStart <= 0 || activePeople.length === 0) {
    // 如果还没有经过任何完整的值班日，或没有活跃人员，显示0
    return (
      <div className={styles.dutyStats}>
        <div className={styles.header}>
          <h3>📊 值班统计</h3>
          <p className={styles.subtitle}>
            统计从 {startDate} 开始至今日之前已完成的值班情况
          </p>
        </div>

        {/* 核心统计 */}
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryNumber}>{activePeople.length}</div>
            <div className={styles.summaryLabel}>参与人数</div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryNumber}>0</div>
            <div className={styles.summaryLabel}>已值班天数</div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryNumber}>{totalFutureDuties}</div>
            <div className={styles.summaryLabel}>未来已排班天数</div>
          </div>
        </div>

        {/* 个人值班统计 */}
        <div className={styles.personalStats}>
          <div className={styles.statsHeader}>
            <h4>个人值班统计</h4>
            <div className={styles.viewToggle}>
              <button 
                className={`${styles.toggleBtn} ${!chartView ? styles.active : ''}`}
                onClick={() => setChartView(false)}
                title="列表视图"
              >
                📋
              </button>
              <button 
                className={`${styles.toggleBtn} ${chartView ? styles.active : ''}`}
                onClick={() => setChartView(true)}
                title="图表视图"
              >
                📊
              </button>
            </div>
          </div>
          
          {chartView ? (
            // 图表视图
            <div className={styles.chartContainer}>
              {activePeople.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={activePeople.map(person => {
                      // 找到对应的未来排班统计
                      const futurestat = futureStats.find(fs => fs.personId === person.id);
                      const futureDuties = futurestat ? futurestat.confirmedDuties : 0;
                      
                      return {
                        name: person.name,
                        已值班: 0, // 在早期返回时，所有人的值班天数都是0
                        未来已排班: futureDuties,
                      };
                    })}
                    margin={{ top: 60, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12, fill: '#333333', fontWeight: 600 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#333333', fontWeight: 600 }}
                      allowDecimals={false}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36}
                      iconType="rect"
                      wrapperStyle={{
                        paddingBottom: '20px',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e9ecef',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        color: '#1a1a1a'
                      }}
                      formatter={(value, name) => [`${value} 天`, name]}
                      labelStyle={{ color: '#1a1a1a', fontWeight: 700 }}
                    />
                    <Bar 
                      dataKey="已值班" 
                      fill="url(#pastGradient)"
                      radius={[4, 4, 0, 0]}
                      name="已值班"
                    >
                      <LabelList 
                        dataKey="已值班" 
                        position="top"
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          fill: '#000000'
                        }}
                      />
                    </Bar>
                    <Bar 
                      dataKey="未来已排班" 
                      fill="url(#futureGradient)"
                      radius={[4, 4, 0, 0]}
                      name="未来已排班"
                    >
                      <LabelList 
                        dataKey="未来已排班" 
                        position="top"
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          fill: '#000000'
                        }}
                      />
                    </Bar>
                    <defs>
                      <linearGradient id="pastGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#667eea" />
                        <stop offset="100%" stopColor="#764ba2" />
                      </linearGradient>
                      <linearGradient id="futureGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f093fb" />
                        <stop offset="100%" stopColor="#f5576c" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.noData}>
                  <p>暂无参与排班的人员</p>
                  <p className={styles.hint}>请先在管理页面添加值班人员</p>
                </div>
              )}
            </div>
          ) : (
            // 列表视图 - 合并显示已值班和未来排班
            <div className={styles.statsList}>
              {activePeople.length > 0 ? (
                activePeople.map((person) => {
                  // 找到对应的未来排班统计
                  const futurestat = futureStats.find(fs => fs.personId === person.id);
                  const futureDuties = futurestat ? futurestat.confirmedDuties : 0;
                  
                  return (
                    <div key={person.id} className={styles.combinedStatsItem}>
                      <div className={styles.personName}>{person.name}</div>
                      <div className={styles.dutyStatsContainer}>
                        <div className={styles.dutyStatGroup}>
                          <span className={styles.statLabel}>已值班</span>
                          <div className={styles.dutyCount}>
                            <span className={styles.count}>0</span>
                            <span className={styles.unit}>天</span>
                          </div>
                        </div>
                        <div className={styles.divider}></div>
                        <div className={styles.dutyStatGroup}>
                          <span className={styles.statLabel}>未来已排班</span>
                          <div className={styles.dutyCount}>
                            <span className={styles.count}>{futureDuties}</span>
                            <span className={styles.unit}>天</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={styles.noData}>
                  <p>暂无参与排班的人员</p>
                  <p className={styles.hint}>请先在管理页面添加值班人员</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 统计说明 */}
        <div className={styles.note}>
          <p>💡 <strong>说明：</strong>此统计包含从值班开始日期（{startDate}）至今日之前的所有值班记录，包括自动轮转分配和手动调整的排班</p>
          <p>🔮 <strong>未来排班：</strong>完全模仿日历"已排班"视图逻辑：手动记录无日期限制，轮转算法仅在7天内有效，连续7天真正"无排班"时停止统计（暂停不算无排班）</p>
        </div>
      </div>
    );
  }
  
  // 生成需要统计的日期范围
  const dateRange = getDateRange(startDate, daysSinceStart);
  const sortedPeople = [...activePeople].sort((a, b) => a.order - b.order);
  
  // 计算每个人应该的值班天数（包括轮转算法和数据库记录）
  const dutyStats = activePeople.map(person => {
    let totalDuties = 0;
    const dutyDates: string[] = [];
    
    dateRange.forEach(date => {
      // 先检查数据库中是否有排班记录
      const existingRecord = schedule.records.find(record => record.date === date);
      
      let assignedPersonId: string | null = null;
      if (existingRecord) {
        // 如果有数据库记录，使用数据库记录
        assignedPersonId = existingRecord.personId;
      } else {
        // 如果没有记录，使用轮转算法计算
        const daysSinceStart = Math.floor((parseDate(date).getTime() - parseDate(startDate).getTime()) / (1000 * 60 * 60 * 24));
        const personIndex = daysSinceStart % sortedPeople.length;
        assignedPersonId = sortedPeople[personIndex].id;
      }
      
      // 如果这一天分配给当前人员，计入统计
      if (assignedPersonId === person.id) {
        totalDuties++;
        dutyDates.push(date);
      }
    });
    
    return {
      personId: person.id,
      personName: person.name,
      totalDuties,
      dutyDates,
      consecutiveDays: 0, // 这里不计算连续天数
      lastDutyDate: dutyDates[dutyDates.length - 1]
    };
  });
  
  // 计算总值班天数
  const totalPastDuties = dutyStats.reduce((sum, stat) => sum + stat.totalDuties, 0);
  const participantCount = activePeople.length;

  // 按过去值班天数排序，值班天数相同的按姓名排序
  const sortedStats = [...dutyStats].sort((a, b) => {
    if (b.totalDuties !== a.totalDuties) {
      return b.totalDuties - a.totalDuties;
    }
    return a.personName.localeCompare(b.personName);
  });

  return (
    <div className={styles.dutyStats}>
      <div className={styles.header}>
        <h3>📊 值班统计</h3>
        <p className={styles.subtitle}>
          统计从 {startDate} 开始至今日之前已完成的值班情况
        </p>
      </div>

      {/* 核心统计 */}
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryNumber}>{participantCount}</div>
          <div className={styles.summaryLabel}>参与人数</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryNumber}>{totalPastDuties}</div>
          <div className={styles.summaryLabel}>已值班天数</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryNumber}>{totalFutureDuties}</div>
          <div className={styles.summaryLabel}>未来已排班天数</div>
        </div>
      </div>

      {/* 个人值班统计 */}
      <div className={styles.personalStats}>
        <div className={styles.statsHeader}>
          <h4>个人值班统计</h4>
          <div className={styles.viewToggle}>
            <button 
              className={`${styles.toggleBtn} ${!chartView ? styles.active : ''}`}
              onClick={() => setChartView(false)}
              title="列表视图"
            >
              📋
            </button>
            <button 
              className={`${styles.toggleBtn} ${chartView ? styles.active : ''}`}
              onClick={() => setChartView(true)}
              title="图表视图"
            >
              📊
            </button>
          </div>
        </div>
        
        {chartView ? (
          // 图表视图
          <div className={styles.chartContainer}>
            {participantCount > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={sortedStats.map(stat => {
                    // 找到对应的未来排班统计
                    const futurestat = futureStats.find(fs => fs.personId === stat.personId);
                    const futureDuties = futurestat ? futurestat.confirmedDuties : 0;
                    
                    return {
                      name: stat.personName,
                      已值班: stat.totalDuties,
                      未来已排班: futureDuties,
                    };
                  })}
                  margin={{ top: 60, right: 30, left: 20, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: '#333333', fontWeight: 600 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#333333', fontWeight: 600 }}
                    allowDecimals={false}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    iconType="rect"
                    wrapperStyle={{
                      paddingBottom: '20px',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      color: '#1a1a1a'
                    }}
                    formatter={(value, name) => [`${value} 天`, name]}
                    labelStyle={{ color: '#1a1a1a', fontWeight: 700 }}
                  />
                  <Bar 
                    dataKey="已值班" 
                    fill="url(#pastGradient)"
                    radius={[4, 4, 0, 0]}
                    name="已值班"
                  >
                    <LabelList 
                      dataKey="已值班" 
                      position="top"
                      style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        fill: '#000000'
                      }}
                    />
                  </Bar>
                  <Bar 
                    dataKey="未来已排班" 
                    fill="url(#futureGradient)"
                    radius={[4, 4, 0, 0]}
                    name="未来已排班"
                  >
                    <LabelList 
                      dataKey="未来已排班" 
                      position="top"
                      style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        fill: '#000000'
                      }}
                    />
                  </Bar>
                  <defs>
                    <linearGradient id="pastGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#667eea" />
                      <stop offset="100%" stopColor="#764ba2" />
                    </linearGradient>
                    <linearGradient id="futureGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f093fb" />
                      <stop offset="100%" stopColor="#f5576c" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.noData}>
                <p>暂无参与排班的人员</p>
                <p className={styles.hint}>请先在管理页面添加值班人员</p>
              </div>
            )}
          </div>
        ) : (
          // 列表视图 - 合并显示已值班和未来排班
          <div className={styles.statsList}>
            {participantCount > 0 ? (
              sortedStats.map((stat) => {
                // 找到对应的未来排班统计
                const futurestat = futureStats.find(fs => fs.personId === stat.personId);
                const futureDuties = futurestat ? futurestat.confirmedDuties : 0;
                
                return (
                  <div key={stat.personId} className={styles.combinedStatsItem}>
                    <div className={styles.personName}>{stat.personName}</div>
                    <div className={styles.dutyStatsContainer}>
                      <div className={styles.dutyStatGroup}>
                        <span className={styles.statLabel}>已值班</span>
                        <div className={styles.dutyCount}>
                          <span className={styles.count}>{stat.totalDuties}</span>
                          <span className={styles.unit}>天</span>
                        </div>
                      </div>
                      <div className={styles.divider}></div>
                      <div className={styles.dutyStatGroup}>
                        <span className={styles.statLabel}>未来已排班</span>
                        <div className={styles.dutyCount}>
                          <span className={styles.count}>{futureDuties}</span>
                          <span className={styles.unit}>天</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.noData}>
                <p>暂无参与排班的人员</p>
                <p className={styles.hint}>请先在管理页面添加值班人员</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 统计说明 */}
      <div className={styles.note}>
        <p>💡 <strong>说明：</strong>此统计包含从值班开始日期（{startDate}）至今日之前的所有值班记录，包括自动轮转分配和手动调整的排班</p>
        <p>🔮 <strong>未来排班：</strong>完全模仿日历"已排班"视图逻辑：手动记录无日期限制，轮转算法仅在7天内有效，连续7天真正"无排班"时停止统计（暂停不算无排班）</p>
      </div>
    </div>
  );
};

export default DutyStats; 