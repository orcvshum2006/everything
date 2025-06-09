import { useMemo, useState, useEffect } from 'react';
import { useDutySchedule } from './hooks/useDutySchedule';
import { formatDate, calculateRotationWithSuspension } from './utils/dutyCalculator';
import { sseClient } from './utils/sseClient';
import type { SSEMessage } from './utils/sseClient';
import type { TodayDuty, DutyRecord } from './types';
import TodayDutyCard from './components/TodayDutyCard/TodayDutyCard';
import PersonManager from './components/PersonManager/PersonManager';
import DateSetting from './components/DateSetting/DateSetting';
import SchedulePreview from './components/SchedulePreview/SchedulePreview';
import DutyCalendar from './components/DutyCalendar/DutyCalendar';
import DutyStats from './components/DutyStats/DutyStats';
import RecordsViewer from './components/RecordsViewer/RecordsViewer';
import { apiService } from './services/api';
import './App.css';
import DateDetailModal from './components/DateDetailModal/DateDetailModal';

function App() {
  const {
    people,
    startDate,
    loading,
    error,
    addPerson,
    removePerson,
    movePersonUp,
    movePersonDown,
    updateStartDate,
    refreshData,
    schedule,
    addRecord,
    removeRecord
  } = useDutySchedule();

  const [currentView, setCurrentView] = useState<'overview' | 'calendar' | 'stats' | 'manage'>('overview');
  const [message, setMessage] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailDate, setDetailDate] = useState<string>('');
  const [showRecords, setShowRecords] = useState(false);

  // 添加SSE实时同步功能
  useEffect(() => {
    let lastSyncTime = 0;
    const SYNC_DEBOUNCE_MS = 1000; // 防抖时间：1秒

    // 同步处理函数，带防抖功能（用于全量更新的情况）
    const handleSync = (reason: string, messageType?: string) => {
      const now = Date.now();
      if (now - lastSyncTime < SYNC_DEBOUNCE_MS) {
        console.log(`⏳ 同步防抖中 (${reason})`);
        return;
      }
      lastSyncTime = now;

      console.log(`🔄 开始全量数据同步 (${reason})...`);
      
      // 重新从后端获取最新数据（仅在必要时使用）
      refreshData().then(() => {
        console.log(`✅ 全量数据同步成功 (${messageType || reason})`);
      }).catch((error) => {
        console.error('❌ 数据同步失败:', error);
      });
    };

    // SSE消息处理
    const handleSSEMessage = (message: SSEMessage) => {
      switch (message.type) {
        case 'connected':
          console.log('🎉 SSE连接成功建立');
          break;
          
        case 'scheduleUpdated':
          console.log('📡 接收到排班数据更新通知');
          // 人员或开始日期等全局信息变化，需要全量更新
          handleSync('sse', 'scheduleUpdated');
          break;
          
        case 'recordAdded':
          console.log('📡 接收到新增排班记录通知');
          // 精确添加记录，无感更新
          if (message.data && message.data.record) {
            console.log('🔄 精确添加记录:', message.data.record);
            addRecord(message.data.record);
          } else {
            // 如果没有具体记录数据，回退到全量更新
            handleSync('sse', 'recordAdded');
          }
          break;
          
        case 'recordDeleted':
          console.log('📡 接收到删除排班记录通知');
          // 精确删除记录，无感更新
          if (message.data && message.data.date) {
            console.log('🔄 精确删除记录:', message.data.date);
            console.log('📦 SSE消息完整数据:', message);
            removeRecord(message.data.date);
          } else {
            console.warn('⚠️ SSE recordDeleted事件缺少日期数据:', message);
            // 如果没有具体日期数据，回退到全量更新
            handleSync('sse', 'recordDeleted');
          }
          break;
          
        case 'swapCompleted':
          console.log('📡 接收到换班操作完成通知');
          // 换班涉及多个记录的变化，使用精确更新
          if (message.data && message.data.records) {
            console.log('🔄 精确更新换班记录:', message.data.records);
            // 先删除相关日期的记录，再添加新记录
            if (message.data.date1) removeRecord(message.data.date1);
            if (message.data.date2) removeRecord(message.data.date2);
            // 添加新的换班记录
            message.data.records.forEach((record: DutyRecord) => {
              addRecord(record);
            });
          } else {
            // 如果没有具体记录数据，回退到全量更新
            handleSync('sse', 'swapCompleted');
          }
          break;
          
        case 'heartbeat':
          // 心跳消息不需要处理，只是保持连接
          break;
          
        default:
          console.log('📡 接收到其他类型的SSE消息:', message.type);
          handleSync('sse', message.type);
      }
    };

    // 建立SSE连接
    sseClient.onMessage(handleSSEMessage);
    sseClient.connect();

    // 页面可见性变化时重新连接
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👁️ 页面重新获得焦点');
        
        if (!sseClient.isConnected()) {
          console.log('🔄 SSE连接已断开，尝试重新连接...');
          sseClient.connect();
        }
        
        // 主动检查数据变化
        handleSync('visibility');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 清理函数
    return () => {
      sseClient.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshData]);

  // 生成包含今天在内的一周值班安排
  const weekSchedule = useMemo(() => {
    if (!schedule) return [];
    
    // 获取活跃人员并按order字段排序
    const activePeople = people.filter(p => p.isActive);
    if (activePeople.length === 0) return [];
    
    const dateRange = [];
    
    // 生成7天的日期范围（今天和未来6天）
    for (let i = 0; i < 7; i++) {
      const date = formatDate(new Date(Date.now() + i * 24 * 60 * 60 * 1000));
      dateRange.push(date);
    }
    
    // 使用与日历页面相同的算法计算排班
    return dateRange.map(date => {
      // 如果日期在startDate之前，不分配排班
      if (date < startDate) {
        return {
          date,
          person: null,
          record: null,
          isManualAssignment: false
        };
      }
      
      // 先检查数据库中是否有排班记录
      const existingRecord = schedule.records.find(record => record.date === date);
      if (existingRecord) {
        // 如果是暂停记录，显示为null
        if (existingRecord.type === 'suspended') {
          return {
            date,
            person: null,
            record: existingRecord,
            isManualAssignment: true // 暂停也是手动操作
          };
        }
        
        // 其他类型的记录，查找对应人员
        const person = people.find(p => p.id === existingRecord.personId);
        return {
          date,
          person: person || null,
          record: existingRecord,
          isManualAssignment: existingRecord.type !== 'auto'
        };
      }
      
      // 如果没有记录，使用考虑暂停日期的轮转算法
      const assignedPerson = calculateRotationWithSuspension(
        startDate,
        date,
        people,
        schedule.records
      );
      
      return {
        date,
        person: assignedPerson,
        record: null,
        isManualAssignment: false
      };
    });
  }, [people, startDate, schedule]);

  // 从weekSchedule中获取今日值班信息，确保数据一致性
  const todayDuty = useMemo((): TodayDuty => {
    const today = formatDate(new Date());
    
    // 先从weekSchedule中查找今日值班
    const todayFromSchedule = weekSchedule.find(item => item.date === today);
    if (todayFromSchedule) {
      return todayFromSchedule;
    }
    
    // 如果没有找到，返回空值班信息
    return {
      date: today,
      person: null,
      record: null,
      isManualAssignment: false
    };
  }, [weekSchedule]);

  // 手动分配排班
  const handleAssignDuty = async (date: string, personId: string) => {
    const person = people.find(p => p.id === personId);
    if (!person) return;

    try {
      setMessage('⏳ 正在分配排班...');
      const response = await apiService.addDutyRecord({
        date,
        personId,
        personName: person.name,
        type: 'manual',
        reason: '手动分配'
      });

      if (response.success) {
        // 依赖SSE实时更新，避免重新拉取人员数据
        setMessage(`✅ 已分配 ${person.name} 在 ${date} 值班`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ 分配失败: ${response.error}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch {
      setMessage('❌ 分配失败，请重试');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // 换班操作
  const handleSwapDuties = async (date1: string, date2: string) => {
    try {
      setMessage('⏳ 正在执行换班...');
      const response = await apiService.swapDuties(date1, date2, '用户换班申请');

      if (response.success) {
        // 依赖SSE实时更新，避免重新拉取人员数据
        setMessage(`✅ 换班成功: ${date1} ↔ ${date2}`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ 换班失败: ${response.error}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch {
      setMessage('❌ 换班失败，请重试');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // 删除排班
  const handleDeleteDuty = async (date: string) => {
    try {
      setMessage('⏳ 正在删除排班...');
      const response = await apiService.deleteDutyRecord(date);

      if (response.success) {
        // 依赖SSE实时更新，避免重新拉取人员数据
        setMessage(`✅ 已删除 ${date} 的排班`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        const errorMsg = response.error || response.message || '删除失败';
        setMessage(`❌ 删除失败: ${errorMsg}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '网络请求失败';
      setMessage(`❌ 删除失败: ${errorMsg}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // 批量删除排班
  const handleBatchDeleteDuties = async (dates: string[]) => {
    if (dates.length === 0) {
      setMessage('❌ 请选择要删除的日期');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      setMessage(`⏳ 正在删除 ${dates.length} 个排班...`);
      const response = await apiService.deleteDutyRecords(dates);

      if (response.success && response.data) {
        // 依赖SSE实时更新，避免重新拉取人员数据
        const { deletedCount, totalRequested, failedDates } = response.data;
        
        if (failedDates && failedDates.length > 0) {
          setMessage(`⚠️ 删除了 ${deletedCount}/${totalRequested} 个排班，${failedDates.length} 个失败`);
        } else {
          setMessage(`✅ 成功删除 ${deletedCount} 个排班`);
        }
        setTimeout(() => setMessage(''), 4000);
      } else {
        const errorMsg = response.error || response.message || '未知错误';
        setMessage(`❌ 批量删除失败: ${errorMsg}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '网络请求失败';
      setMessage(`❌ 批量删除失败: ${errorMsg}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // 暂停单个日期的排班
  const handleSuspendDuty = async (date: string, reason?: string) => {
    try {
      setMessage('⏳ 正在暂停排班...');
      const response = await apiService.addDutyRecord({
        date,
        personId: null,
        personName: null,
        type: 'suspended',
        reason: reason || '暂停排班'
      });

      if (response.success) {
        // 依赖SSE实时更新，避免重新拉取人员数据
        setMessage(`✅ 已暂停 ${date} 的排班`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ 暂停失败: ${response.error}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '网络请求失败';
      setMessage(`❌ 暂停失败: ${errorMsg}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // 批量暂停排班
  const handleBatchSuspendDuties = async (dates: string[], reason?: string) => {
    if (dates.length === 0) {
      setMessage('❌ 请选择要暂停的日期');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      setMessage(`⏳ 正在暂停 ${dates.length} 个排班...`);
      
      // 批量添加暂停记录
      const promises = dates.map(date => 
        apiService.addDutyRecord({
          date,
          personId: null,
          personName: null,
          type: 'suspended',
          reason: reason || '批量暂停排班'
        })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      
      // 依赖SSE实时更新，避免重新拉取人员数据
      
      if (successCount === dates.length) {
        setMessage(`✅ 成功暂停 ${successCount} 个排班`);
      } else {
        setMessage(`⚠️ 暂停了 ${successCount}/${dates.length} 个排班`);
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '网络请求失败';
      setMessage(`❌ 批量暂停失败: ${errorMsg}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // 恢复排班
  const handleResumeDuty = async (date: string) => {
    try {
      setMessage('⏳ 正在恢复排班...');
      const response = await apiService.deleteDutyRecord(date);

      if (response.success) {
        // 主要依赖SSE实时更新，同时添加一个备用方案
        
        // 根据后端返回的消息判断是否有实际删除记录
        const isActualDelete = !response.message?.includes('原本无特殊记录');
        
        // 检查恢复后的轮转排班结果（使用当前人员数据）
        const activePeople = people.filter(p => p.isActive);
        if (activePeople.length === 0) {
          setMessage(`✅ 已恢复 ${date} 的排班（当前无活跃人员，显示为无排班）`);
        } else {
          // 进一步检查轮转算法的结果
          const assignedPerson = calculateRotationWithSuspension(
            startDate,
            date,
            people,
            schedule ? schedule.records.filter(r => r.date !== date) : []
          );
          
          if (!assignedPerson) {
            setMessage(`✅ 已恢复 ${date} 的排班（显示为无排班）`);
          } else {
            // 确保分配的人员确实在当前活跃人员列表中
            const isValidPerson = activePeople.some(p => p.id === assignedPerson.id);
            if (isValidPerson) {
              if (isActualDelete) {
                setMessage(`✅ 已恢复 ${date} 的排班，自动分配给 ${assignedPerson.name}`);
              } else {
                setMessage(`✅ ${date} 已确认为正常排班状态，分配给 ${assignedPerson.name}`);
              }
            } else {
              console.warn(`⚠️ 轮转算法分配了不存在的人员: ${assignedPerson.name} (${assignedPerson.id})`);
              setMessage(`✅ 已恢复 ${date} 的排班（原分配人员已删除，显示为无排班）`);
            }
          }
        }
        
        console.log('🎉 恢复排班完成，等待SSE更新记录状态');
        
        // 备用方案：如果5秒后仍然显示记录存在，则手动触发状态更新
        setTimeout(() => {
          if (schedule && schedule.records.some(r => r.date === date)) {
            console.log('⚠️ SSE更新可能失败，手动移除记录状态');
            removeRecord(date);
          }
        }, 5000);
        
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ 恢复失败: ${response.error}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '网络请求失败';
      setMessage(`❌ 恢复失败: ${errorMsg}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // 替班操作
  const handleReplaceDuty = async (date: string, personId: string, reason: string) => {
    try {
      setMessage('⏳ 正在处理替班...');
      
      // 查找替班人员信息
      const person = people.find(p => p.id === personId);
      if (!person) {
        setMessage('❌ 替班失败: 找不到指定人员');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      // 调用添加记录API，类型为replacement
      const response = await apiService.addDutyRecord({
        date,
        personId,
        personName: person.name,
        type: 'replacement' as const,
        reason: reason || '替班',
      });

      if (response.success) {
        // 不再调用 refreshData()，改为依赖SSE实时更新
        setMessage(`✅ ${person.name} 已替班 ${date}`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ 替班失败: ${response.error}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '网络请求失败';
      setMessage(`❌ 替班失败: ${errorMsg}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleShowDayDetail = (date: string) => {
    setDetailDate(date);
    setShowDetailModal(true);
  };

  // 处理导航切换，切换时滚动到顶部
  const handleViewChange = (view: 'overview' | 'calendar' | 'stats' | 'manage') => {
    setCurrentView(view);
    // 瞬间跳转到页面顶部，不使用滚动动画
    window.scrollTo(0, 0);
  };

  // 加载状态
  if (loading) {
    return (
      <div className="app">
        <div className="container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>正在加载值班表数据...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <header className="app-header">
          <h1>智能值班管理系统</h1>
          <p>灵活排班 · 智能分配 · 公平管理</p>
          {error && (
            <div className="error-banner">
              <span className="error-text">⚠️ {error}</span>
              <button onClick={refreshData} className="retry-button">
                重试
              </button>
            </div>
          )}
          {message && (
            <div className="message-banner">
              {message}
            </div>
          )}
        </header>

        {/* 移动端导航 */}
        <nav className="mobile-nav">
          <button 
            className={`nav-item ${currentView === 'overview' ? 'active' : ''}`}
            onClick={() => handleViewChange('overview')}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-label">概览</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`}
            onClick={() => handleViewChange('calendar')}
          >
            <span className="nav-icon">📅</span>
            <span className="nav-label">日历</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'stats' ? 'active' : ''}`}
            onClick={() => handleViewChange('stats')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">统计</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'manage' ? 'active' : ''}`}
            onClick={() => handleViewChange('manage')}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">管理</span>
          </button>
        </nav>

        <main className="main-content">
          {currentView === 'overview' && (
            <div className="overview-view">
              <TodayDutyCard todayDuty={todayDuty} />
              
              <SchedulePreview schedule={weekSchedule} />
            </div>
          )}

          {currentView === 'calendar' && schedule && (
            <div className="calendar-view">
              <DutyCalendar 
                schedule={schedule}
                startDate={startDate}
                onAssignDuty={handleAssignDuty}
                onSwapDuties={handleSwapDuties}
                onDeleteDuty={handleDeleteDuty}
                onBatchDeleteDuties={handleBatchDeleteDuties}
                onSuspendDuty={handleSuspendDuty}
                onBatchSuspendDuties={handleBatchSuspendDuties}
                onResumeDuty={handleResumeDuty}
                onReplaceDuty={handleReplaceDuty}
                onShowDayDetail={handleShowDayDetail}
              />
            </div>
          )}

          {currentView === 'stats' && schedule && (
            <div className="stats-view">
              <DutyStats schedule={schedule} />
            </div>
          )}

          {currentView === 'manage' && (
            <div className="manage-view">
              <PersonManager
                people={people}
                onAddPerson={addPerson}
                onRemovePerson={removePerson}
                onMovePersonUp={movePersonUp}
                onMovePersonDown={movePersonDown}
              />
              <DateSetting
                startDate={startDate}
                onUpdateStartDate={updateStartDate}
              />
              
              {/* 排班记录查看按钮 */}
              <div className="records-section">
                <button 
                  className={`action-button ${showRecords ? 'secondary' : 'primary'}`}
                  onClick={() => setShowRecords(!showRecords)}
                >
                  <span className="button-icon">📋</span>
                  <span className="button-text">
                    {showRecords ? '隐藏排班记录' : '查看排班记录'}
                  </span>
                </button>
                
                {/* 排班记录查看器 */}
                {showRecords && schedule && (
                  <RecordsViewer schedule={schedule} people={people} />
                )}
              </div>
            </div>
          )}
        </main>

        {/* 日期详情模态框 */}
        {showDetailModal && detailDate && schedule && (
          <DateDetailModal
            date={detailDate}
            schedule={schedule}
            onClose={() => setShowDetailModal(false)}
          />
        )}

        <footer className="app-footer">
          {/* 底部占位空间，避免内容被导航栏遮挡 */}
        </footer>
      </div>
    </div>
  );
}

export default App;