import { useState, useEffect, useCallback } from 'react';
import type { Person, DutySchedule } from '../types';
import { apiService } from '../services/api';
import { DEFAULT_RULES } from '../utils/dutyCalculator';

export const useDutySchedule = () => {
  const [schedule, setSchedule] = useState<DutySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 便捷访问器，保持向后兼容
  const people = schedule?.people || [];
  const startDate = schedule?.startDate || new Date().toISOString().split('T')[0];

  // 从服务器加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.getDutySchedule();
      
      if (response.success && response.data) {
        // 确保people数组中的每个人都有isActive字段
        const scheduleData = {
          ...response.data,
          people: (response.data.people || []).map(person => ({
            ...person,
            isActive: person.isActive !== undefined ? person.isActive : true
          }))
        };
        
        setSchedule(scheduleData);
      } else {
        setError(response.error || '获取数据失败');
      }
    } catch (err) {
      setError('网络连接失败，请检查后端服务是否启动');
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 保存数据到服务器
  const saveToServer = useCallback(async (newPeople: Person[], newStartDate: string) => {
    try {
      const scheduleData: DutySchedule = {
        people: newPeople,
        startDate: newStartDate,
        rules: schedule?.rules || DEFAULT_RULES,
        records: schedule?.records || [],
        swapRequests: schedule?.swapRequests || [],
        leaveRecords: schedule?.leaveRecords || [],
        lastUpdated: new Date().toISOString()
      };
      
      const response = await apiService.updateDutySchedule(scheduleData);
      
      if (!response.success) {
        setError(response.error || '保存数据失败');
        return false;
      }
      
      setError(null);
      return true;
    } catch (err) {
      setError('保存失败，请检查网络连接');
      console.error('保存数据失败:', err);
      return false;
    }
  }, [schedule]);

  // 添加人员
  const addPerson = useCallback(async (name: string) => {
    if (!name.trim()) return;
    
    const newPerson: Person = {
      id: Date.now().toString(),
      name: name.trim(),
      order: people.length + 1,
      isActive: true
    };
    
    const newPeople = [...people, newPerson];
    
    // 乐观更新
    if (schedule) {
      setSchedule({
        ...schedule,
        people: newPeople
      });
    }
    
    const success = await saveToServer(newPeople, startDate);
    if (!success && schedule) {
      // 如果保存失败，回滚状态
      setSchedule({
        ...schedule,
        people: people
      });
    }
  }, [people, startDate, saveToServer, schedule]);

  // 删除人员
  const removePerson = useCallback(async (id: string) => {
    const personToDelete = people.find(p => p.id === id);
    if (!personToDelete) {
      setError('找不到要删除的人员');
      return;
    }

    const newPeople = people
      .filter(person => person.id !== id)
      .map((person, index) => ({ ...person, order: index + 1 })); // 重新排序
    
    // 同时删除该人员相关的所有排班记录
    const filteredRecords = schedule?.records.filter(record => record.personId !== id) || [];
    
    const updatedSchedule = {
      ...schedule!,
      people: newPeople,
      records: filteredRecords
    };

    // 乐观更新
    setSchedule(updatedSchedule);
    
    try {
      console.log(`🗑️ 删除人员: ${personToDelete.name} (ID: ${id})`);
      console.log(`📊 删除前人员数量: ${people.length}, 删除后: ${newPeople.length}`);
      
      const response = await apiService.updateDutySchedule(updatedSchedule);
      
      if (!response.success) {
        const errorMsg = response.error || '删除人员失败';
        setError(errorMsg);
        console.error('❌ 删除人员失败:', errorMsg);
        // 如果保存失败，回滚状态
        setSchedule(schedule!);
        return;
      }
      
      console.log(`✅ 人员 ${personToDelete.name} 删除成功`);
      setError(null);
      
      // 删除成功，等待SSE更新状态
      // 不再进行自动验证，因为SSE会实时同步最新数据
      console.log('等待SSE更新最新状态...');
      
      // 临时备用方案：如果5秒后仍然能在状态中找到删除的人员，则手动刷新
      setTimeout(async () => {
        if (schedule && schedule.people.some(p => p.id === id)) {
          console.log('⚠️ SSE更新可能失败，手动刷新数据');
          await loadData();
        }
      }, 5000);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '网络连接失败';
      setError(`删除失败: ${errorMsg}`);
      console.error('❌ 删除人员网络错误:', err);
      // 如果保存失败，回滚状态
      setSchedule(schedule!);
    }
  }, [people, schedule, loadData]);

  // 更新人员顺序
  const updatePersonOrder = useCallback(async (personId: string, newOrder: number) => {
    const newPeople = people.map(person => 
      person.id === personId 
        ? { ...person, order: newOrder }
        : person
    );
    
    // 乐观更新
    if (schedule) {
      setSchedule({
        ...schedule,
        people: newPeople
      });
    }
    
    const success = await saveToServer(newPeople, startDate);
    if (!success && schedule) {
      // 如果保存失败，回滚状态
      setSchedule({
        ...schedule,
        people: people
      });
    }
  }, [people, startDate, saveToServer, schedule]);

  // 向上移动
  const movePersonUp = useCallback(async (id: string) => {
    const person = people.find(p => p.id === id);
    if (!person || person.order <= 1) return;
    
    const newPeople = people.map(p => {
      if (p.id === id) return { ...p, order: p.order - 1 };
      if (p.order === person.order - 1) return { ...p, order: p.order + 1 };
      return p;
    });
    
    // 乐观更新
    if (schedule) {
      setSchedule({
        ...schedule,
        people: newPeople
      });
    }
    
    const success = await saveToServer(newPeople, startDate);
    if (!success && schedule) {
      // 如果保存失败，回滚状态
      setSchedule({
        ...schedule,
        people: people
      });
    }
  }, [people, startDate, saveToServer, schedule]);

  // 向下移动
  const movePersonDown = useCallback(async (id: string) => {
    const person = people.find(p => p.id === id);
    if (!person || person.order >= people.length) return;
    
    const newPeople = people.map(p => {
      if (p.id === id) return { ...p, order: p.order + 1 };
      if (p.order === person.order + 1) return { ...p, order: p.order - 1 };
      return p;
    });
    
    // 乐观更新
    if (schedule) {
      setSchedule({
        ...schedule,
        people: newPeople
      });
    }
    
    const success = await saveToServer(newPeople, startDate);
    if (!success && schedule) {
      // 如果保存失败，回滚状态
      setSchedule({
        ...schedule,
        people: people
      });
    }
  }, [people, startDate, saveToServer, schedule]);

  // 更新开始日期
  const updateStartDate = useCallback(async (newStartDate: string) => {
    if (!schedule) return;
    
    // 过滤掉在新开始日期之前的排班记录
    const filteredRecords = schedule.records.filter(record => record.date >= newStartDate);
    
    const updatedSchedule = {
      ...schedule,
      startDate: newStartDate,
      records: filteredRecords
    };
    
    // 乐观更新
    setSchedule(updatedSchedule);
    
    // 保存到服务器
    try {
      const response = await apiService.updateDutySchedule(updatedSchedule);
      
      if (!response.success) {
        setError(response.error || '保存数据失败');
        // 如果保存失败，回滚状态
        setSchedule(schedule);
        return false;
      }
      
      setError(null);
      return true;
    } catch (err) {
      setError('保存失败，请检查网络连接');
      console.error('保存数据失败:', err);
      // 如果保存失败，回滚状态
      setSchedule(schedule);
      return false;
    }
  }, [schedule]);

  // 添加直接更新schedule的方法（用于实时同步）
  const updateSchedule = useCallback((newSchedule: DutySchedule) => {
    setSchedule(newSchedule);
  }, []);

  // 增量更新方法 - 添加记录
  const addRecord = useCallback((record: any) => {
    setSchedule(prevSchedule => {
      if (!prevSchedule) return prevSchedule;
      
      // 移除同日期的现有记录，然后添加新记录
      const filteredRecords = prevSchedule.records.filter(r => r.date !== record.date);
      
      return {
        ...prevSchedule,
        records: [...filteredRecords, record],
        lastUpdated: new Date().toISOString()
      };
    });
  }, []);

  // 增量更新方法 - 删除记录
  const removeRecord = useCallback((date: string) => {
    console.log(`🗑️ removeRecord被调用，删除日期: ${date}`);
    
    setSchedule(prevSchedule => {
      if (!prevSchedule) {
        console.warn('⚠️ prevSchedule为空，无法删除记录');
        return prevSchedule;
      }
      
      const beforeCount = prevSchedule.records.length;
      const filteredRecords = prevSchedule.records.filter(r => r.date !== date);
      const afterCount = filteredRecords.length;
      
      console.log(`📊 删除记录状态更新: 删除前${beforeCount}条，删除后${afterCount}条`);
      
      if (beforeCount === afterCount) {
        console.log(`ℹ️ 没有找到日期${date}的记录需要删除`);
      } else {
        console.log(`✅ 成功删除日期${date}的记录`);
      }
      
      const newSchedule = {
        ...prevSchedule,
        records: filteredRecords,
        lastUpdated: new Date().toISOString()
      };
      
      console.log('🔄 更新后的schedule:', {
        recordsCount: newSchedule.records.length,
        lastUpdated: newSchedule.lastUpdated
      });
      
      return newSchedule;
    });
  }, []);

  // 增量更新方法 - 更新人员信息
  const updatePeople = useCallback((newPeople: any[]) => {
    setSchedule(prevSchedule => {
      if (!prevSchedule) return prevSchedule;
      
      return {
        ...prevSchedule,
        people: newPeople,
        lastUpdated: new Date().toISOString()
      };
    });
  }, []);

  // 增量更新方法 - 更新开始日期
  const updateStartDateOnly = useCallback((newStartDate: string) => {
    setSchedule(prevSchedule => {
      if (!prevSchedule) return prevSchedule;
      
      return {
        ...prevSchedule,
        startDate: newStartDate,
        lastUpdated: new Date().toISOString()
      };
    });
  }, []);

  // 更新schedule并通知其他设备
  const updateScheduleAndNotify = useCallback(async (newSchedule: DutySchedule) => {
    try {
      // 保存到服务器
      const response = await apiService.updateDutySchedule(newSchedule);
      
      if (!response.success) {
        setError(response.error || '保存数据失败');
        return false;
      }
      
      // 更新本地状态
      setSchedule(newSchedule);
      setError(null);
      
      return true;
    } catch (err) {
      setError('保存失败，请检查网络连接');
      console.error('保存数据失败:', err);
      return false;
    }
  }, []);

  return {
    // 完整的数据对象
    schedule,
    
    // 便捷访问器（向后兼容）
    people,
    startDate,
    
    // 状态
    loading,
    error,
    
    // 操作函数
    addPerson,
    removePerson,
    updatePersonOrder,
    movePersonUp,
    movePersonDown,
    updateStartDate,
    refreshData: loadData,
    updateSchedule,
    updateScheduleAndNotify,
    addRecord,
    removeRecord,
    updatePeople,
    updateStartDateOnly,
    
    // 内部状态管理（用于高级功能）
    setSchedule
  };
}; 