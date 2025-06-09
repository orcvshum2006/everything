const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'duty-schedule.json');

// 中间件
app.use(cors());
app.use(express.json());

// 确保数据目录存在
fs.ensureDirSync(path.dirname(DATA_FILE));

// 默认数据结构
const getDefaultData = () => ({
  people: [],
  startDate: new Date().toISOString().split('T')[0],
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
});

// 初始化数据文件
const initializeDataFile = async () => {
  try {
    await fs.access(DATA_FILE);
    // 检查现有数据结构，如果是旧版本则迁移
    const existingData = await fs.readJson(DATA_FILE);
    if (!existingData.records || !existingData.rules) {
      // 迁移旧数据到新结构
      const migratedData = {
        ...getDefaultData(),
        people: existingData.people || [],
        startDate: existingData.startDate || new Date().toISOString().split('T')[0]
      };
      
      // 确保people数组中的每个人都有isActive字段
      migratedData.people = migratedData.people.map(person => ({
        ...person,
        isActive: person.isActive !== undefined ? person.isActive : true
      }));
      
      await fs.writeJson(DATA_FILE, migratedData, { spaces: 2 });
      console.log('📝 数据结构已升级到新版本');
    }
  } catch (error) {
    // 文件不存在，创建默认数据
    await fs.writeJson(DATA_FILE, getDefaultData(), { spaces: 2 });
    console.log('📁 已创建默认数据文件');
  }
};

// 读取数据
const readData = async () => {
  try {
    const data = await fs.readJson(DATA_FILE);
    return {
      ...getDefaultData(),
      ...data,
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  } catch (error) {
    console.error('读取数据文件失败:', error);
    return getDefaultData();
  }
};

// 写入数据
const writeData = async (data) => {
  try {
    const dataWithTimestamp = {
      ...data,
      lastUpdated: new Date().toISOString()
    };
    await fs.writeJson(DATA_FILE, dataWithTimestamp, { spaces: 2 });
    return true;
  } catch (error) {
    console.error('写入数据文件失败:', error);
    return false;
  }
};

// API 路由

// 获取值班表数据
app.get('/api/duty-schedule', async (req, res) => {
  try {
    const data = await readData();
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
    const { people, startDate, rules, records, swapRequests, leaveRecords } = req.body;
    
    // 验证必要字段
    if (!Array.isArray(people) || !startDate) {
      return res.status(400).json({
        success: false,
        message: '缺少必要字段: people 和 startDate'
      });
    }

    const newData = {
      people,
      startDate,
      rules: rules || getDefaultData().rules,
      records: records || [],
      swapRequests: swapRequests || [],
      leaveRecords: leaveRecords || []
    };
    
    const success = await writeData(newData);
    
    if (success) {
      res.json({
        success: true,
        data: newData,
        message: '数据更新成功'
      });
    } else {
      res.status(500).json({
        success: false,
        message: '数据保存失败'
      });
    }
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

    const data = await readData();
    
    // 创建新记录
    const newRecord = {
      id: `${type}_${date}_${personId}_${Date.now()}`,
      date,
      personId,
      personName,
      type,
      reason,
      originalPersonId,
      createdAt: new Date().toISOString()
    };

    // 移除同一日期的现有记录
    data.records = data.records.filter(record => record.date !== date);
    
    // 添加新记录
    data.records.push(newRecord);
    data.records.sort((a, b) => a.date.localeCompare(b.date));

    const success = await writeData(data);
    
    if (success) {
      res.json({
        success: true,
        data: newRecord,
        message: '排班记录添加成功'
      });
    } else {
      res.status(500).json({
        success: false,
        message: '保存失败'
      });
    }
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

    const data = await readData();
    const activePeople = data.people.filter(p => p.isActive);
    
    if (activePeople.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有可用的值班人员'
      });
    }
    
    const sortedPeople = [...activePeople].sort((a, b) => a.order - b.order);
    
    // 获取或生成第一个日期的排班信息
    let record1 = data.records.find(r => r.date === date1);
    let person1;
    
    if (!record1) {
      // 如果数据库中没有记录，使用轮转算法计算
      const startDate = new Date(data.startDate || new Date().toISOString().split('T')[0]);
      const date1Obj = new Date(date1);
      const daysSinceStart1 = Math.floor((date1Obj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const personIndex1 = daysSinceStart1 % sortedPeople.length;
      person1 = sortedPeople[personIndex1];
    } else {
      person1 = data.people.find(p => p.id === record1.personId);
    }
    
    // 获取或生成第二个日期的排班信息
    let record2 = data.records.find(r => r.date === date2);
    let person2;
    
    if (!record2) {
      // 如果数据库中没有记录，使用轮转算法计算
      const startDate = new Date(data.startDate || new Date().toISOString().split('T')[0]);
      const date2Obj = new Date(date2);
      const daysSinceStart2 = Math.floor((date2Obj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const personIndex2 = daysSinceStart2 % sortedPeople.length;
      person2 = sortedPeople[personIndex2];
    } else {
      person2 = data.people.find(p => p.id === record2.personId);
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

    // 创建换班记录
    const swapRecord1 = {
      id: `swap_${date1}_${person2.id}_${Date.now()}`,
      date: date1,
      personId: person2.id,
      personName: person2.name,
      type: 'swap',
      originalPersonId: person1.id,
      reason,
      createdAt: new Date().toISOString()
    };

    const swapRecord2 = {
      id: `swap_${date2}_${person1.id}_${Date.now() + 1}`,
      date: date2,
      personId: person1.id,
      personName: person1.name,
      type: 'swap',
      originalPersonId: person2.id,
      reason,
      createdAt: new Date().toISOString()
    };

    // 替换原记录（如果存在的话）
    data.records = data.records.filter(r => r.date !== date1 && r.date !== date2);
    data.records.push(swapRecord1, swapRecord2);
    data.records.sort((a, b) => a.date.localeCompare(b.date));

    const success = await writeData(data);
    
    if (success) {
      res.json({
        success: true,
        data: [swapRecord1, swapRecord2],
        message: `换班成功: ${person1.name}(${date1}) ↔ ${person2.name}(${date2})`
      });
    } else {
      res.status(500).json({
        success: false,
        message: '换班失败'
      });
    }
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
    
    const data = await readData();
    const originalLength = data.records.length;
    
    data.records = data.records.filter(record => record.date !== date);
    
    if (data.records.length === originalLength) {
      return res.status(404).json({
        success: false,
        message: '找不到指定日期的排班记录'
      });
    }

    const success = await writeData(data);
    
    if (success) {
      res.json({
        success: true,
        message: '排班记录删除成功'
      });
    } else {
      res.status(500).json({
        success: false,
        message: '删除失败'
      });
    }
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

    const data = await readData();
    const activePeople = data.people.filter(p => p.isActive);
    
    if (activePeople.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有可用的值班人员'
      });
    }

    // 简单的自动排班算法
    const start = new Date(startDate);
    const end = new Date(endDate);
    const newRecords = [];
    
    if (respectExisting) {
      // 保留现有的手动/换班记录
      data.records.forEach(record => {
        const recordDate = new Date(record.date);
        if (recordDate >= start && recordDate <= end && record.type !== 'auto') {
          newRecords.push(record);
        }
      });
    }
    
    // 为没有排班的日期自动分配
    const existingDates = new Set(newRecords.map(r => r.date));
    let personIndex = 0;
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      if (!existingDates.has(dateStr)) {
        const person = activePeople[personIndex % activePeople.length];
        const autoRecord = {
          id: `auto_${dateStr}_${person.id}`,
          date: dateStr,
          personId: person.id,
          personName: person.name,
          type: 'auto',
          createdAt: new Date().toISOString()
        };
        newRecords.push(autoRecord);
        personIndex++;
      }
    }

    // 更新数据
    data.records = data.records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate < start || recordDate > end;
    });
    
    data.records.push(...newRecords);
    data.records.sort((a, b) => a.date.localeCompare(b.date));

    const success = await writeData(data);
    
    if (success) {
      res.json({
        success: true,
        data: newRecords,
        message: `成功生成 ${newRecords.length} 条排班记录`
      });
    } else {
      res.status(500).json({
        success: false,
        message: '保存排班记录失败'
      });
    }
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
    message: '服务运行正常',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// 获取数据统计
app.get('/api/stats', async (req, res) => {
  try {
    const data = await readData();
    
    const stats = {
      totalPeople: data.people.length,
      activePeople: data.people.filter(p => p.isActive).length,
      totalRecords: data.records.length,
      swapRequests: data.swapRequests.length,
      leaveRecords: data.leaveRecords.length,
      lastUpdated: data.lastUpdated
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

// 启动服务器
const startServer = async () => {
  await initializeDataFile();
  app.listen(PORT, () => {
    console.log(`🚀 值班表后端服务启动成功！`);
    console.log(`📡 服务地址: http://localhost:${PORT}`);
    console.log(`📋 API 文档:`);
    console.log(`   GET  /api/duty-schedule      - 获取值班表数据`);
    console.log(`   PUT  /api/duty-schedule      - 更新值班表数据`);
    console.log(`   POST /api/duty-records       - 添加排班记录`);
    console.log(`   POST /api/swap-duties        - 换班操作`);
    console.log(`   POST /api/generate-schedule  - 生成自动排班`);
    console.log(`   GET  /api/stats              - 获取统计数据`);
    console.log(`   GET  /api/health             - 健康检查`);
  });
};

startServer().catch(console.error); 