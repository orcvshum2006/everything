const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database/init');
const { shouldMigrate, migrateFromJson } = require('./database/migrate');
const { 
  PeopleModel, 
  DutyRecordsModel, 
  SwapRequestsModel, 
  LeaveRecordsModel, 
  SystemConfigModel, 
  DutyRulesModel 
} = require('./database/models');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

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
    if (people && people.length > 0) {
      // 获取现有人员ID
      const existingPeople = PeopleModel.getAll();
      const existingIds = new Set(existingPeople.map(p => p.id));
      const newIds = new Set(people.map(p => p.id));

      // 删除不再存在的人员
      for (const existingPerson of existingPeople) {
        if (!newIds.has(existingPerson.id)) {
          PeopleModel.delete(existingPerson.id);
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
    const { date, personId, personName, type, reason, originalPersonId } = req.body;
    
    if (!date || !personId || !personName || !type) {
      return res.status(400).json({
        success: false,
        message: '缺少必要字段'
      });
    }

    // 删除同一日期的现有记录
    DutyRecordsModel.deleteByDate(date);
    
    // 创建新记录
    const record = {
      id: `${type}_${date}_${personId}_${Date.now()}`,
      date,
      person_id: personId,
      person_name: personName,
      type,
      original_person_id: originalPersonId,
      reason,
      created_by: null
    };

    DutyRecordsModel.create(record);
    SystemConfigModel.set('last_updated', new Date().toISOString());

    res.json({
      success: true,
      data: transformDutyRecord({
        ...record,
        created_at: new Date().toISOString()
      }),
      message: '排班记录添加成功'
    });
  } catch (error) {
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

    // 删除原有记录
    DutyRecordsModel.deleteByDate(date1);
    DutyRecordsModel.deleteByDate(date2);

    // 创建换班记录
    const swapRecord1 = {
      id: `swap_${date1}_${person2.id}_${Date.now()}`,
      date: date1,
      person_id: person2.id,
      person_name: person2.name,
      type: 'swap',
      original_person_id: person1.id,
      reason,
      created_by: null
    };

    const swapRecord2 = {
      id: `swap_${date2}_${person1.id}_${Date.now() + 1}`,
      date: date2,
      person_id: person1.id,
      person_name: person1.name,
      type: 'swap',
      original_person_id: person2.id,
      reason,
      created_by: null
    };

    DutyRecordsModel.create(swapRecord1);
    DutyRecordsModel.create(swapRecord2);
    SystemConfigModel.set('last_updated', new Date().toISOString());

    res.json({
      success: true,
      data: [
        transformDutyRecord({ ...swapRecord1, created_at: new Date().toISOString() }),
        transformDutyRecord({ ...swapRecord2, created_at: new Date().toISOString() })
      ],
      message: `换班成功: ${person1.name}(${date1}) ↔ ${person2.name}(${date2})`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '换班操作失败',
      error: error.message
    });
  }
});

// 删除排班记录
app.delete('/api/duty-records/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    const result = DutyRecordsModel.deleteByDate(date);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到指定日期的排班记录'
      });
    }

    SystemConfigModel.set('last_updated', new Date().toISOString());

    res.json({
      success: true,
      message: '排班记录删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除排班记录失败',
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

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🔄 正在关闭服务器...');
  const { closeDatabase } = require('./database/init');
  closeDatabase();
  process.exit(0);
});

// 启动服务器
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 值班表后端服务启动成功！(SQLite版本)`);
      console.log(`📡 服务地址: http://localhost:${PORT}`);
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