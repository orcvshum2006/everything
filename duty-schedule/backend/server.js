// 加载环境变量
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database/init-sqlite3');
const { shouldMigrate, migrateFromJson } = require('./database/migrate');
const { 
  PeopleModel, 
  DutyRecordsModel, 
  SwapRequestsModel, 
  LeaveRecordsModel, 
  SystemConfigModel, 
  DutyRulesModel 
} = require('./database/models-sqlite3');

const app = express();
const PORT = process.env.PORT || 8081;
const HOST = process.env.HOST || '0.0.0.0';

// SSE 客户端管理
const sseClients = new Set();

// SSE 广播函数
const broadcast = (eventType, data) => {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      console.error('SSE广播错误:', error);
      sseClients.delete(client);
    }
  });
};

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务 - 提供前端构建文件
app.use(express.static(path.join(__dirname, 'public')));

// 初始化数据库和迁移数据
const initializeDatabase = async () => {
  try {
    // 检查是否需要迁移
    if (await shouldMigrate()) {
      console.log('🔄 检测到需要从JSON迁移数据...');
      await migrateFromJson();
    } else {
      // 如果不需要迁移，就初始化数据库
      initDatabase();
    }
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
};

// 数据转换函数：将数据库结果转换为前端期望的格式
const transformPerson = (dbPerson) => ({
  id: dbPerson.id,
  name: dbPerson.name,
  order: dbPerson.order_index,
  isActive: Boolean(dbPerson.is_active),
  email: dbPerson.email,
  phone: dbPerson.phone
});

const transformDutyRecord = (dbRecord) => ({
  id: dbRecord.id,
  date: dbRecord.date,
  personId: dbRecord.person_id,
  personName: dbRecord.person_name,
  type: dbRecord.type,
  originalPersonId: dbRecord.original_person_id,
  reason: dbRecord.reason,
  createdAt: dbRecord.created_at,
  createdBy: dbRecord.created_by
});

const transformSwapRequest = (dbSwap) => ({
  id: dbSwap.id,
  fromPersonId: dbSwap.from_person_id,
  toPersonId: dbSwap.to_person_id,
  fromDate: dbSwap.from_date,
  toDate: dbSwap.to_date,
  reason: dbSwap.reason,
  status: dbSwap.status,
  createdAt: dbSwap.created_at,
  approvedAt: dbSwap.approved_at
});

const transformLeaveRecord = (dbLeave) => ({
  id: dbLeave.id,
  personId: dbLeave.person_id,
  startDate: dbLeave.start_date,
  endDate: dbLeave.end_date,
  reason: dbLeave.reason,
  type: dbLeave.type,
  createdAt: dbLeave.created_at
});

const transformRules = (dbRules) => ({
  maxConsecutiveDays: dbRules.max_consecutive_days,
  minRestDays: dbRules.min_rest_days,
  excludeWeekends: Boolean(dbRules.exclude_weekends),
  excludeHolidays: Boolean(dbRules.exclude_holidays),
  fairnessWeight: dbRules.fairness_weight
});

// API 路由

// 获取值班表数据
app.get('/api/duty-schedule', async (req, res) => {
  try {
    // 获取所有相关数据
    const people = PeopleModel.getAll().map(transformPerson);
    const records = DutyRecordsModel.getAll().map(transformDutyRecord);
    const swapRequests = SwapRequestsModel.getAll().map(transformSwapRequest);
    const leaveRecords = LeaveRecordsModel.getAll().map(transformLeaveRecord);
    const rules = transformRules(DutyRulesModel.get() || {});
    
    const startDate = SystemConfigModel.get('start_date') || new Date().toISOString().split('T')[0];
    const lastUpdated = SystemConfigModel.get('last_updated') || new Date().toISOString();

    const data = {
      people,
      startDate,
      rules,
      records,
      swapRequests,
      leaveRecords,
      lastUpdated
    };

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取数据失败',
      error: error.message
    });
  }
});

// 更新值班表数据
app.put('/api/duty-schedule', async (req, res) => {
  try {
    const { people, startDate, rules } = req.body;
    
    // 验证必要字段
    if (!Array.isArray(people) || !startDate) {
      return res.status(400).json({
        success: false,
        message: '缺少必要字段: people 和 startDate'
      });
    }

    // 更新人员信息
    if (people !== undefined && Array.isArray(people)) {
      // 获取现有人员ID
      const existingPeople = PeopleModel.getAll();
      const existingIds = new Set(existingPeople.map(p => p.id));
      const newIds = new Set(people.map(p => p.id));

      // 删除不再存在的人员
      for (const existingPerson of existingPeople) {
        if (!newIds.has(existingPerson.id)) {
          console.log(`🗑️ 删除人员: ${existingPerson.name} (ID: ${existingPerson.id})`);
          
          // 先删除该人员的所有排班记录
          const deletedRecords = DutyRecordsModel.deleteByPersonId(existingPerson.id);
          console.log(`  - 清理了 ${deletedRecords.changes} 个相关排班记录`);
          
          // 再删除人员记录
          const deletedPerson = PeopleModel.delete(existingPerson.id);
          console.log(`  - 删除人员结果: ${deletedPerson.changes > 0 ? '成功' : '失败'}`);
          
          if (deletedPerson.changes === 0) {
            console.error(`❌ 删除人员 ${existingPerson.name} 失败`);
          }
        }
      }

      // 更新或添加人员
      for (const person of people) {
        if (existingIds.has(person.id)) {
          PeopleModel.update(person.id, {
            name: person.name,
            order_index: person.order,
            is_active: person.isActive !== false,
            email: person.email,
            phone: person.phone
          });
        } else {
          PeopleModel.create({
            id: person.id,
            name: person.name,
            order_index: person.order,
            is_active: person.isActive !== false,
            email: person.email,
            phone: person.phone
          });
        }
      }
    }

    // 更新开始日期
    if (startDate) {
      SystemConfigModel.set('start_date', startDate);
    }

    // 更新排班规则
    if (rules) {
      DutyRulesModel.update({
        max_consecutive_days: rules.maxConsecutiveDays || 3,
        min_rest_days: rules.minRestDays || 1,
        exclude_weekends: rules.excludeWeekends || false,
        exclude_holidays: rules.excludeHolidays || false,
        fairness_weight: rules.fairnessWeight || 0.8
      });
    }

    // 更新最后修改时间
    SystemConfigModel.set('last_updated', new Date().toISOString());

    // 广播SSE更新，通知所有客户端数据已更新
    broadcast('scheduleUpdated', {
      message: '排班数据已更新',
      timestamp: new Date().toISOString()
    });
    console.log('📤 SSE广播: scheduleUpdated，发送给', sseClients.size, '个客户端');

    res.json({
      success: true,
      message: '数据更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新数据失败',
      error: error.message
    });
  }
});

// 添加单个排班记录
app.post('/api/duty-records', async (req, res) => {
  try {
    console.log('📋 收到添加排班记录请求:');
    console.log('  - 请求体:', JSON.stringify(req.body, null, 2));
    
    const { date, personId, personName, type, reason, originalPersonId } = req.body;
    
    // 验证必要字段
    console.log('🔍 验证请求字段:');
    console.log(`  - date: ${date} (type: ${typeof date} )`);
    console.log(`  - personId: ${personId} (type: ${typeof personId} )`);
    console.log(`  - personName: ${personName} (type: ${typeof personName} )`);
    console.log(`  - type: ${type} (type: ${typeof type} )`);
    console.log(`  - reason: ${reason} (type: ${typeof reason} )`);
    
    // 对于暂停类型，允许personId和personName为null
    if (!date || !type) {
      return res.status(400).json({
        success: false,
        message: '缺少必要字段：date 和 type 是必需的'
      });
    }
    
    // 对于非暂停类型，检查personId和personName
    if (type !== 'suspended' && (!personId || !personName)) {
      return res.status(400).json({
        success: false,
        message: '对于非暂停类型的记录，personId 和 personName 是必需的'
      });
    }
    
    console.log('✅ 验证通过，开始处理记录');

    // 删除同一日期的现有记录
    DutyRecordsModel.deleteByDate(date);
    
    // 创建当前时间戳
    const currentTime = new Date().toISOString();
    
    // 创建新记录
    const record = {
      id: `${type}_${date}_${Date.now()}`,
      date,
      person_id: personId,
      person_name: personName,
      type,
      original_person_id: originalPersonId,
      reason,
      created_by: null,
      created_at: currentTime  // 显式设置创建时间
    };

    console.log('💾 即将保存的记录:', JSON.stringify(record, null, 2));

    DutyRecordsModel.create(record);
    SystemConfigModel.set('last_updated', currentTime);

    // 广播SSE更新，包含完整的记录信息
    const transformedRecord = transformDutyRecord(record);
    broadcast('recordAdded', {
      record: transformedRecord
    });
    console.log('📤 SSE广播: recordAdded，发送给', sseClients.size, '个客户端');

    res.json({
      success: true,
      data: transformedRecord,
      message: '排班记录添加成功'
    });
    console.log('🎉 排班记录处理成功');
  } catch (error) {
    console.error('❌ 添加排班记录时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '添加排班记录失败',
      error: error.message
    });
  }
});

// 换班操作
app.post('/api/swap-duties', async (req, res) => {
  try {
    const { date1, date2, reason } = req.body;
    
    if (!date1 || !date2) {
      return res.status(400).json({
        success: false,
        message: '缺少必要字段: date1 和 date2'
      });
    }

    const activePeople = PeopleModel.getAll().filter(p => p.is_active);
    
    if (activePeople.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有可用的值班人员'
      });
    }
    
    const sortedPeople = [...activePeople].sort((a, b) => a.order_index - b.order_index);
    const startDate = SystemConfigModel.get('start_date') || new Date().toISOString().split('T')[0];
    
    // 获取或生成第一个日期的排班信息
    let record1 = DutyRecordsModel.getByDate(date1);
    let person1;
    
    if (!record1) {
      // 使用轮转算法计算
      const date1Obj = new Date(date1);
      const startDateObj = new Date(startDate);
      const daysSinceStart1 = Math.floor((date1Obj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
      const personIndex1 = daysSinceStart1 % sortedPeople.length;
      person1 = sortedPeople[personIndex1];
    } else {
      person1 = PeopleModel.getById(record1.person_id);
    }
    
    // 获取或生成第二个日期的排班信息
    let record2 = DutyRecordsModel.getByDate(date2);
    let person2;
    
    if (!record2) {
      // 使用轮转算法计算
      const date2Obj = new Date(date2);
      const startDateObj = new Date(startDate);
      const daysSinceStart2 = Math.floor((date2Obj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
      const personIndex2 = daysSinceStart2 % sortedPeople.length;
      person2 = sortedPeople[personIndex2];
    } else {
      person2 = PeopleModel.getById(record2.person_id);
    }
    
    if (!person1 || !person2) {
      return res.status(400).json({
        success: false,
        message: '找不到相关人员信息'
      });
    }
    
    // 如果是同一个人，不允许换班
    if (person1.id === person2.id) {
      return res.status(400).json({
        success: false,
        message: '不能与自己换班'
      });
    }

    // 保存原始记录信息（在删除前）
    const originalRecord1 = record1 ? {
      type: record1.type,
      original_person_id: record1.original_person_id,
      reason: record1.reason
    } : null;
    
    const originalRecord2 = record2 ? {
      type: record2.type,
      original_person_id: record2.original_person_id,
      reason: record2.reason
    } : null;

    // 计算原始轮转排班应该的人员分配
    const date1Obj = new Date(date1);
    const date2Obj = new Date(date2);
    const startDateObj = new Date(startDate);
    const daysSinceStart1 = Math.floor((date1Obj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceStart2 = Math.floor((date2Obj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    const autoPersonForDate1 = sortedPeople[daysSinceStart1 % sortedPeople.length];
    const autoPersonForDate2 = sortedPeople[daysSinceStart2 % sortedPeople.length];

    // 确定每个日期的"真正原始状态"
    // 如果是换班记录，需要追踪到最初的原始状态
    let trueOriginalPersonForDate1, trueOriginalTypeForDate1, trueOriginalReasonForDate1;
    let trueOriginalPersonForDate2, trueOriginalTypeForDate2, trueOriginalReasonForDate2;
    
    if (originalRecord1) {
      if (originalRecord1.type === 'manual') {
        // 如果当前是手动分配，那么当前人员就是真正的原始状态
        trueOriginalPersonForDate1 = person1.id;
        trueOriginalTypeForDate1 = 'manual';
        trueOriginalReasonForDate1 = originalRecord1.reason;
      } else if (originalRecord1.type === 'swap' && originalRecord1.original_person_id) {
        // 如果当前是换班记录，需要追踪到真正的原始人员
        trueOriginalPersonForDate1 = originalRecord1.original_person_id;
        // 查找原始记录的类型（需要通过original_person_id查找之前的记录）
        // 简化处理：假设原始记录是手动分配（大多数情况）
        trueOriginalTypeForDate1 = 'manual';
        trueOriginalReasonForDate1 = originalRecord1.reason;
      } else {
        // 其他类型记录
        trueOriginalPersonForDate1 = person1.id;
        trueOriginalTypeForDate1 = originalRecord1.type;
        trueOriginalReasonForDate1 = originalRecord1.reason;
      }
    } else {
      // 没有记录，使用自动排班
      trueOriginalPersonForDate1 = autoPersonForDate1.id;
      trueOriginalTypeForDate1 = 'auto';
      trueOriginalReasonForDate1 = null;
    }
    
    if (originalRecord2) {
      if (originalRecord2.type === 'manual') {
        trueOriginalPersonForDate2 = person2.id;
        trueOriginalTypeForDate2 = 'manual';
        trueOriginalReasonForDate2 = originalRecord2.reason;
      } else if (originalRecord2.type === 'swap' && originalRecord2.original_person_id) {
        trueOriginalPersonForDate2 = originalRecord2.original_person_id;
        trueOriginalTypeForDate2 = 'manual';
        trueOriginalReasonForDate2 = originalRecord2.reason;
      } else {
        trueOriginalPersonForDate2 = person2.id;
        trueOriginalTypeForDate2 = originalRecord2.type;
        trueOriginalReasonForDate2 = originalRecord2.reason;
      }
    } else {
      trueOriginalPersonForDate2 = autoPersonForDate2.id;
      trueOriginalTypeForDate2 = 'auto';
      trueOriginalReasonForDate2 = null;
    }

    // 删除原有记录
    DutyRecordsModel.deleteByDate(date1);
    DutyRecordsModel.deleteByDate(date2);

    const responseData = [];
    const responseMessages = [];

    // 处理 date1 的新记录（换班后分配给 person2）
    if (person2.id === trueOriginalPersonForDate1 && trueOriginalTypeForDate1 === 'manual') {
      // 换班后恢复为真正的原始手动分配
      const restoredRecord1 = {
        id: `manual_${date1}_${person2.id}_${Date.now()}`,
        date: date1,
        person_id: person2.id,
        person_name: person2.name,
        type: 'manual',
        original_person_id: null,
        reason: trueOriginalReasonForDate1,
        created_by: null
      };
      DutyRecordsModel.create(restoredRecord1);
      responseData.push(transformDutyRecord({ ...restoredRecord1, created_at: new Date().toISOString() }));
      responseMessages.push(`${date1}: ${person2.name}(恢复手动分配)`);
    } else if (person2.id === autoPersonForDate1.id && trueOriginalTypeForDate1 === 'auto') {
      // 只有当原始状态确实是自动排班，且换班后又恢复为同一个自动排班人员时，才不创建记录
      responseMessages.push(`${date1}: ${person2.name}(恢复自动排班)`);
    } else {
      // 创建换班记录，保留真正的原始人员信息
      const swapRecord1 = {
        id: `swap_${date1}_${person2.id}_${Date.now()}`,
        date: date1,
        person_id: person2.id,
        person_name: person2.name,
        type: 'swap',
        original_person_id: trueOriginalPersonForDate1,
        reason,
        created_by: null
      };
      DutyRecordsModel.create(swapRecord1);
      responseData.push(transformDutyRecord({ ...swapRecord1, created_at: new Date().toISOString() }));
      responseMessages.push(`${date1}: ${person2.name}(换班)`);
    }

    // 处理 date2 的新记录（换班后分配给 person1）
    if (person1.id === trueOriginalPersonForDate2 && trueOriginalTypeForDate2 === 'manual') {
      // 换班后恢复为真正的原始手动分配
      const restoredRecord2 = {
        id: `manual_${date2}_${person1.id}_${Date.now() + 1}`,
        date: date2,
        person_id: person1.id,
        person_name: person1.name,
        type: 'manual',
        original_person_id: null,
        reason: trueOriginalReasonForDate2,
        created_by: null
      };
      DutyRecordsModel.create(restoredRecord2);
      responseData.push(transformDutyRecord({ ...restoredRecord2, created_at: new Date().toISOString() }));
      responseMessages.push(`${date2}: ${person1.name}(恢复手动分配)`);
    } else if (person1.id === autoPersonForDate2.id && trueOriginalTypeForDate2 === 'auto') {
      // 只有当原始状态确实是自动排班，且换班后又恢复为同一个自动排班人员时，才不创建记录
      responseMessages.push(`${date2}: ${person1.name}(恢复自动排班)`);
    } else {
      // 创建换班记录，保留真正的原始人员信息
      const swapRecord2 = {
        id: `swap_${date2}_${person1.id}_${Date.now() + 1}`,
        date: date2,
        person_id: person1.id,
        person_name: person1.name,
        type: 'swap',
        original_person_id: trueOriginalPersonForDate2,
        reason,
        created_by: null
      };
      DutyRecordsModel.create(swapRecord2);
      responseData.push(transformDutyRecord({ ...swapRecord2, created_at: new Date().toISOString() }));
      responseMessages.push(`${date2}: ${person1.name}(换班)`);
    }

    SystemConfigModel.set('last_updated', new Date().toISOString());

    res.json({
      success: true,
      data: responseData,
      message: `换班操作完成: ${responseMessages.join(', ')}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '换班操作失败',
      error: error.message
    });
  }
});

// 删除单个排班记录
app.delete('/api/duty-records/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    const result = DutyRecordsModel.deleteByDate(date);
    
    // 修改逻辑：如果没有找到记录也返回成功
    // 因为"恢复排班"的目标就是确保没有特殊记录
    if (result.changes === 0) {
      console.log(`📅 ${date} 没有找到要删除的排班记录，视为已恢复到正常轮转状态`);
      
      // SSE广播删除事件（即使没有实际删除，也通知前端更新）
      broadcast('recordDeleted', { date });
      
      return res.json({
        success: true,
        message: '排班已恢复到正常轮转状态（原本无特殊记录）'
      });
    }

    console.log(`🗑️ 成功删除 ${date} 的排班记录`);
    
    // SSE广播删除事件
    broadcast('recordDeleted', { date });

    res.json({
      success: true,
      message: '排班记录删除成功'
    });
  } catch (error) {
    console.error('删除排班记录时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '删除排班记录失败',
      error: error.message
    });
  }
});

// 批量删除排班记录
app.delete('/api/duty-records', async (req, res) => {
  try {
    console.log('📋 收到批量删除排班记录请求:');
    console.log('  - 请求体:', JSON.stringify(req.body, null, 2));
    
    const { dates } = req.body;
    
    // 验证必要字段
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'dates字段是必需的，且必须是非空数组'
      });
    }
    
    console.log(`🔍 批量删除 ${dates.length} 个日期:`, dates);
    
    let deletedCount = 0;
    const failedDates = [];
    
    // 逐个删除记录
    for (const date of dates) {
      try {
        const result = DutyRecordsModel.deleteByDate(date);
        if (result.changes > 0) {
          deletedCount++;
          console.log(`✅ 成功删除 ${date} 的排班记录`);
        } else {
          console.log(`⚠️ ${date} 没有找到要删除的记录`);
          failedDates.push(date);
        }
      } catch (error) {
        console.error(`❌ 删除 ${date} 时发生错误:`, error.message);
        failedDates.push(date);
      }
    }
    
    // 广播删除事件（对于成功删除的记录）
    const successfulDates = dates.filter(date => !failedDates.includes(date));
    for (const date of successfulDates) {
      broadcast('recordDeleted', { date });
    }
    
    console.log(`🎉 批量删除完成: 成功 ${deletedCount}/${dates.length} 个`);
    
    res.json({
      success: true,
      data: {
        deletedCount,
        totalRequested: dates.length,
        failedDates: failedDates.length > 0 ? failedDates : undefined
      },
      message: `成功删除 ${deletedCount}/${dates.length} 个排班记录`
    });
    
  } catch (error) {
    console.error('❌ 批量删除排班记录时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '批量删除排班记录失败',
      error: error.message
    });
  }
});

// 生成自动排班
app.post('/api/generate-schedule', async (req, res) => {
  try {
    const { startDate, endDate, respectExisting = true } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: '缺少必要字段: startDate 和 endDate'
      });
    }

    const activePeople = PeopleModel.getAll().filter(p => p.is_active);
    
    if (activePeople.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有可用的值班人员'
      });
    }

    const sortedPeople = [...activePeople].sort((a, b) => a.order_index - b.order_index);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const newRecords = [];
    
    // 如果保留现有记录，获取现有的手动/换班记录
    let existingRecords = [];
    if (respectExisting) {
      existingRecords = DutyRecordsModel.getByDateRange(startDate, endDate)
        .filter(record => record.type !== 'auto');
    }
    
    // 为没有排班的日期自动分配
    const existingDates = new Set(existingRecords.map(r => r.date));
    let personIndex = 0;
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      if (!existingDates.has(dateStr)) {
        const person = sortedPeople[personIndex % sortedPeople.length];
        const autoRecord = {
          id: `auto_${dateStr}_${person.id}`,
          date: dateStr,
          person_id: person.id,
          person_name: person.name,
          type: 'auto',
          original_person_id: null,
          reason: null,
          created_by: null
        };
        newRecords.push(autoRecord);
        personIndex++;
      }
    }

    // 删除日期范围内的自动排班记录
    const allRecordsInRange = DutyRecordsModel.getByDateRange(startDate, endDate);
    for (const record of allRecordsInRange) {
      if (record.type === 'auto') {
        DutyRecordsModel.delete(record.id);
      }
    }
    
    // 插入新的自动排班记录
    for (const record of newRecords) {
      DutyRecordsModel.create(record);
    }

    SystemConfigModel.set('last_updated', new Date().toISOString());

    res.json({
      success: true,
      data: newRecords.map(r => transformDutyRecord({ ...r, created_at: new Date().toISOString() })),
      message: `成功生成 ${newRecords.length} 条排班记录`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '生成排班失败',
      error: error.message
    });
  }
});

// 数据清理接口 - 清理孤立的排班记录
app.post('/api/cleanup-orphaned-records', async (req, res) => {
  try {
    console.log('🧹 开始清理孤立的排班记录...');
    
    // 获取所有活跃的人员ID
    const activePeople = PeopleModel.getAll();
    const activePeopleIds = new Set(activePeople.map(p => p.id));
    
    // 获取所有排班记录
    const allRecords = DutyRecordsModel.getAll();
    
    // 找出孤立的记录（personId不为null但人员不存在）
    const orphanedRecords = allRecords.filter(record => 
      record.person_id && !activePeopleIds.has(record.person_id)
    );
    
    console.log(`🔍 发现 ${orphanedRecords.length} 个孤立的排班记录`);
    
    let deletedCount = 0;
    
    // 逐个删除孤立记录
    for (const record of orphanedRecords) {
      try {
        const result = DutyRecordsModel.delete(record.id);
        if (result.changes > 0) {
          deletedCount++;
          console.log(`  - 删除孤立记录: ${record.date} - ${record.person_name} (${record.person_id})`);
        }
      } catch (error) {
        console.error(`  ❌ 删除记录 ${record.id} 失败:`, error.message);
      }
    }
    
    // 更新系统配置
    SystemConfigModel.set('last_updated', new Date().toISOString());
    
    // 广播更新事件
    broadcast('scheduleUpdated', {
      message: `清理了 ${deletedCount} 个孤立记录`,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: {
        totalOrphanedRecords: orphanedRecords.length,
        deletedCount,
        orphanedRecords: orphanedRecords.map(r => ({
          id: r.id,
          date: r.date,
          personName: r.person_name,
          personId: r.person_id,
          type: r.type
        }))
      },
      message: `成功清理 ${deletedCount}/${orphanedRecords.length} 个孤立记录`
    });
    
    console.log(`🎉 清理完成，删除了 ${deletedCount} 个孤立记录`);
    
  } catch (error) {
    console.error('❌ 清理孤立记录时发生错误:', error);
    res.status(500).json({
      success: false,
      message: '清理孤立记录失败',
      error: error.message
    });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常 (SQLite版本)',
    timestamp: new Date().toISOString(),
    version: '2.0.0-sqlite',
    database: 'SQLite'
  });
});

// 获取数据统计
app.get('/api/stats', async (req, res) => {
  try {
    const people = PeopleModel.getAll();
    const records = DutyRecordsModel.getAll();
    const swapRequests = SwapRequestsModel.getAll();
    const leaveRecords = LeaveRecordsModel.getAll();
    const lastUpdated = SystemConfigModel.get('last_updated');

    const stats = {
      totalPeople: people.length,
      activePeople: people.filter(p => p.is_active).length,
      totalRecords: records.length,
      swapRequests: swapRequests.length,
      leaveRecords: leaveRecords.length,
      lastUpdated
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  }
});

// SSE 事件流端点
app.get('/api/events', (req, res) => {
  console.log('📡 SSE客户端连接，当前连接数:', sseClients.size + 1);
  
  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // 发送初始连接确认
  res.write('event: connected\ndata: {"message":"Connected to SSE"}\n\n');

  // 添加客户端到集合
  sseClients.add(res);

  // 处理客户端断开连接
  req.on('close', () => {
    console.log('📡 SSE客户端断开，当前连接数:', sseClients.size - 1);
    sseClients.delete(res);
  });

  req.on('aborted', () => {
    console.log('📡 SSE客户端中断，当前连接数:', sseClients.size - 1);
    sseClients.delete(res);
  });
});

// 前端SPA路由处理 - 所有非API请求都返回index.html
app.get('*', (req, res) => {
  // 如果请求路径以/api开头，说明是API请求，应该返回404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: '接口不存在'
    });
  }
  // 其他所有请求都返回前端的index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🔄 正在关闭服务器...');
  const { closeDatabase } = require('./database/init-sqlite3');
  closeDatabase();
  process.exit(0);
});

// 启动服务器
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, HOST, () => {
      console.log(`🚀 值班表后端服务启动成功！(SQLite版本)`);
      console.log(`📡 服务地址: http://localhost:${PORT}`);
      console.log(`🌐 局域网地址: http://${HOST}:${PORT}`);
      console.log(`🗄️ 数据库: SQLite`);
      console.log(`📋 API 文档:`);
      console.log(`   GET  /api/duty-schedule      - 获取值班表数据`);
      console.log(`   PUT  /api/duty-schedule      - 更新值班表数据`);
      console.log(`   POST /api/duty-records       - 添加排班记录`);
      console.log(`   POST /api/swap-duties        - 换班操作`);
      console.log(`   POST /api/generate-schedule  - 生成自动排班`);
      console.log(`   GET  /api/stats              - 获取统计数据`);
      console.log(`   GET  /api/health             - 健康检查`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
};

startServer(); 