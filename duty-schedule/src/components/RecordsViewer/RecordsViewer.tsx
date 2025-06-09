import type { DutySchedule, Person } from '../../types';
import { calculateRotationWithSuspension } from '../../utils/dutyCalculator';
import './RecordsViewer.css';

interface RecordsViewerProps {
  schedule: DutySchedule;
  people: Person[];
}

function RecordsViewer({ schedule, people }: RecordsViewerProps) {
  return (
    <div className="schedule-records-viewer">
      <h3>📋 数据库排班记录</h3>
      <div className="records-info">
        <p>显示所有手动分配、换班和替班的确定记录（不包括自动轮转）</p>
      </div>
      {schedule.records.length === 0 ? (
        <div className="empty-records">
          <p>📝 暂无排班记录</p>
          <p>提示：在日历页面点击日期可以手动分配排班，或使用换班功能</p>
        </div>
      ) : (
        <div className="records-list">
          {(() => {
            // 处理记录，将换班操作和批量手动分配合并显示
            const processedRecords: Array<{
              id: string;
              type: string;
              isGroup: boolean;
              dateDisplay: string;
              personDisplay: string;
              createdAt: string;
              sortKey: string;
              count?: number;
            }> = [];
            const swapGroups = new Map<string, typeof schedule.records>();
            const manualGroups = new Map<string, typeof schedule.records>();
            const otherRecords: typeof schedule.records = [];
            
            // 分类记录
            schedule.records.forEach((record) => {
              if (record.type === 'swap') {
                // 基于reason和时间戳分组换班记录
                const groupKey = `${record.reason}_${Math.floor(new Date(record.createdAt).getTime() / 60000)}`;
                if (!swapGroups.has(groupKey)) {
                  swapGroups.set(groupKey, []);
                }
                swapGroups.get(groupKey)?.push(record);
              } else if (record.type === 'manual') {
                // 基于人员和时间戳分组手动记录（5分钟内的记录合并）
                const groupKey = `${record.personId}_${Math.floor(new Date(record.createdAt).getTime() / (5 * 60000))}`;
                if (!manualGroups.has(groupKey)) {
                  manualGroups.set(groupKey, []);
                }
                manualGroups.get(groupKey)?.push(record);
              } else {
                otherRecords.push(record);
              }
            });
            
            // 处理换班记录
            swapGroups.forEach((records: typeof schedule.records, groupKey: string) => {
              if (records.length >= 2) {
                // 确保是成对的换班记录
                const record1 = records[0];
                const record2 = records[1];
                const person1 = people.find(p => p.id === record1.personId);
                const person2 = people.find(p => p.id === record2.personId);
                
                // 安全的日期解析
                const parseRecordDate = (dateStr: string): Date => {
                  try {
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) {
                      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        return new Date(dateStr + 'T00:00:00');
                      }
                      throw new Error('Invalid date format');
                    }
                    return date;
                  } catch (error) {
                    console.error('日期解析失败:', dateStr, error);
                    return new Date(); // fallback
                  }
                };
                
                const date1 = parseRecordDate(record1.date);
                const date2 = parseRecordDate(record2.date);
                const dateDisplay1 = `${date1.getMonth() + 1}月${date1.getDate()}日`;
                const dateDisplay2 = `${date2.getMonth() + 1}月${date2.getDate()}日`;
                
                processedRecords.push({
                  id: `swap_${groupKey}`,
                  type: 'swap',
                  isGroup: true,
                  dateDisplay: `${dateDisplay1} ↔ ${dateDisplay2}`,
                  personDisplay: `${person1?.name || '未知'} ↔ ${person2?.name || '未知'}`,
                  createdAt: record1.createdAt,
                  sortKey: record1.date
                });
              } else {
                // 单个换班记录（可能是异常情况）
                records.forEach((record) => {
                  const person = people.find(p => p.id === record.personId);
                  
                  // 安全的日期解析
                  let date: Date;
                  try {
                    date = new Date(record.date);
                    if (isNaN(date.getTime())) {
                      if (record.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        date = new Date(record.date + 'T00:00:00');
                      } else {
                        throw new Error('Invalid date format');
                      }
                    }
                  } catch (error) {
                    console.error('日期解析失败:', record.date, error);
                    date = new Date();
                  }
                  
                  const dateDisplay = `${date.getMonth() + 1}月${date.getDate()}日`;
                  
                  processedRecords.push({
                    id: record.id,
                    type: record.type,
                    isGroup: false,
                    dateDisplay,
                    personDisplay: person?.name || '未知人员',
                    createdAt: record.createdAt,
                    sortKey: record.date
                  });
                });
              }
            });
            
            // 处理手动分配记录
            manualGroups.forEach((records: typeof schedule.records, groupKey: string) => {
              if (records.length > 1) {
                // 批量手动分配，合并显示
                const firstRecord = records[0];
                const person = people.find(p => p.id === firstRecord.personId);
                
                // 安全的日期解析和排序
                const sortedDates = records
                  .map(r => {
                    try {
                      let date = new Date(r.date);
                      if (isNaN(date.getTime())) {
                        if (r.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                          date = new Date(r.date + 'T00:00:00');
                        } else {
                          throw new Error('Invalid date format');
                        }
                      }
                      return date;
                    } catch (error) {
                      console.error('日期解析失败:', r.date, error);
                      return new Date();
                    }
                  })
                  .sort((a, b) => a.getTime() - b.getTime());
                
                let dateDisplay: string;
                if (sortedDates.length === 2) {
                  const date1 = sortedDates[0];
                  const date2 = sortedDates[1];
                  dateDisplay = `${date1.getMonth() + 1}月${date1.getDate()}日、${date2.getMonth() + 1}月${date2.getDate()}日`;
                } else if (sortedDates.length === 3) {
                  const date1 = sortedDates[0];
                  const date2 = sortedDates[1];
                  const date3 = sortedDates[2];
                  dateDisplay = `${date1.getMonth() + 1}月${date1.getDate()}日、${date2.getMonth() + 1}月${date2.getDate()}日、${date3.getMonth() + 1}月${date3.getDate()}日`;
                } else {
                  const firstDate = sortedDates[0];
                  dateDisplay = `${firstDate.getMonth() + 1}月${firstDate.getDate()}日 等${records.length}个日期`;
                }
                
                processedRecords.push({
                  id: `manual_group_${groupKey}`,
                  type: 'manual',
                  isGroup: true,
                  dateDisplay,
                  personDisplay: person?.name || '未知人员',
                  createdAt: firstRecord.createdAt,
                  sortKey: firstRecord.date,
                  count: records.length
                });
              } else {
                // 单个手动分配记录
                records.forEach((record) => {
                  const person = people.find(p => p.id === record.personId);
                  
                  // 安全的日期解析
                  let date: Date;
                  try {
                    date = new Date(record.date);
                    if (isNaN(date.getTime())) {
                      if (record.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        date = new Date(record.date + 'T00:00:00');
                      } else {
                        throw new Error('Invalid date format');
                      }
                    }
                  } catch (error) {
                    console.error('日期解析失败:', record.date, error);
                    date = new Date();
                  }
                  
                  const dateDisplay = `${date.getMonth() + 1}月${date.getDate()}日`;
                  
                  processedRecords.push({
                    id: record.id,
                    type: record.type,
                    isGroup: false,
                    dateDisplay,
                    personDisplay: person?.name || '未知人员',
                    createdAt: record.createdAt,
                    sortKey: record.date
                  });
                });
              }
            });
            
            // 处理其他记录
            otherRecords.forEach((record) => {
              const person = people.find(p => p.id === record.personId);
              
              // 安全的日期解析
              let date: Date;
              try {
                date = new Date(record.date);
                // 检查日期是否有效
                if (isNaN(date.getTime())) {
                  // 如果直接解析失败，尝试格式化日期字符串
                  const dateStr = record.date.toString();
                  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    date = new Date(dateStr + 'T00:00:00');
                  } else {
                    throw new Error('Invalid date format');
                  }
                }
              } catch (error) {
                console.error('日期解析失败:', record.date, error);
                date = new Date(); // 使用当前日期作为fallback
              }
              
              const dateDisplay = `${date.getMonth() + 1}月${date.getDate()}日`;
              
              let personDisplay = person?.name || '未知人员';
              
              // 如果是替班记录，需要显示更详细的信息
              if (record.type === 'replacement') {
                // 获取该日期原本应该值班的人员
                const filteredRecords = schedule.records.filter(r => r.date !== record.date);
                
                const originalPerson = calculateRotationWithSuspension(
                  schedule.startDate,
                  record.date,
                  people,
                  filteredRecords
                );
                
                if (originalPerson && originalPerson.id !== record.personId) {
                  personDisplay = `${person?.name || '未知'} 替 ${originalPerson.name}`;
                } else {
                  personDisplay = `${person?.name || '未知'} (替班)`;
                }
              }
              
              processedRecords.push({
                id: record.id,
                type: record.type,
                isGroup: false,
                dateDisplay,
                personDisplay,
                createdAt: record.createdAt,
                sortKey: record.date
              });
            });
            
            // 按日期排序并显示前10条
            return processedRecords
              .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
              .slice(0, 10)
              .map(processedRecord => (
                <div key={processedRecord.id} className={`record-item ${processedRecord.isGroup && processedRecord.type === 'manual' ? 'batch-manual' : ''}`}>
                  <div className="record-date">{processedRecord.dateDisplay}</div>
                  <div className="record-person">
                    {processedRecord.personDisplay}
                  </div>
                  <div className={`record-type ${processedRecord.type} ${processedRecord.isGroup && processedRecord.type === 'manual' ? 'batch' : ''}`}>
                    {processedRecord.type === 'manual' ? (
                      processedRecord.isGroup && processedRecord.count ? 
                        `批量手动分配 (${processedRecord.count}个)` : 
                        '手动分配'
                    ) :
                     processedRecord.type === 'swap' ? '换班' :
                     processedRecord.type === 'replacement' ? '替班' : '自动'}
                  </div>
                  <div className="record-time">
                    {(() => {
                      try {
                        let createdDate: Date;
                        
                        // 处理不同的时间格式
                        if (typeof processedRecord.createdAt === 'string') {
                          // 如果是ISO字符串，直接解析
                          if (processedRecord.createdAt.includes('T')) {
                            createdDate = new Date(processedRecord.createdAt);
                          } else {
                            // 如果是纯日期字符串，添加时间部分
                            createdDate = new Date(processedRecord.createdAt + 'T00:00:00');
                          }
                        } else if (typeof processedRecord.createdAt === 'number') {
                          // 如果是时间戳
                          createdDate = new Date(processedRecord.createdAt);
                        } else {
                          // 其他类型，尝试直接转换
                          createdDate = new Date(processedRecord.createdAt);
                        }
                        
                        // 检查日期是否有效
                        if (isNaN(createdDate.getTime())) {
                          return '时间未知';
                        }
                        
                        // 格式化为本地时间
                        const formatOptions: Intl.DateTimeFormatOptions = {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        };
                        
                        return createdDate.toLocaleString('zh-CN', formatOptions);
                      } catch (error) {
                        console.error('创建时间解析失败:', processedRecord.createdAt, error);
                        return '时间解析失败';
                      }
                    })()}
                  </div>
                </div>
              ));
          })()}
          {schedule.records.length > 10 && (
            <div className="more-records">
              还有 {Math.max(0, schedule.records.length - 10)} 条记录...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RecordsViewer; 