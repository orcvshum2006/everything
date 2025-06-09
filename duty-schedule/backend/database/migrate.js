const fs = require('fs-extra');
const path = require('path');
const { initDatabase } = require('./init');
const { 
  PeopleModel, 
  DutyRecordsModel, 
  SwapRequestsModel, 
  LeaveRecordsModel, 
  SystemConfigModel, 
  DutyRulesModel 
} = require('./models');

const JSON_FILE = path.join(__dirname, '../data/duty-schedule.json');
const BACKUP_FILE = path.join(__dirname, '../data/duty-schedule-backup.json');

// 迁移函数
const migrateFromJson = async () => {
  try {
    console.log('🔄 开始数据迁移...');

    // 检查JSON文件是否存在
    if (!await fs.pathExists(JSON_FILE)) {
      console.log('📝 未找到现有JSON数据文件，跳过迁移');
      return;
    }

    // 读取JSON数据
    const jsonData = await fs.readJson(JSON_FILE);
    console.log('📖 已读取JSON数据');

    // 备份原始JSON文件
    await fs.copy(JSON_FILE, BACKUP_FILE);
    console.log('💾 已备份原始JSON文件');

    // 初始化数据库
    initDatabase();

    // 迁移人员数据
    if (jsonData.people && Array.isArray(jsonData.people)) {
      console.log(`👥 迁移 ${jsonData.people.length} 个人员...`);
      for (const person of jsonData.people) {
        try {
          PeopleModel.create({
            id: person.id,
            name: person.name,
            order_index: person.order || 0,
            is_active: person.isActive !== false,
            email: person.email || null,
            phone: person.phone || null
          });
        } catch (error) {
          console.warn(`⚠️ 迁移人员 ${person.name} 失败:`, error.message);
        }
      }
      console.log('✅ 人员数据迁移完成');
    }

    // 迁移排班记录
    if (jsonData.records && Array.isArray(jsonData.records)) {
      console.log(`📅 迁移 ${jsonData.records.length} 个排班记录...`);
      for (const record of jsonData.records) {
        try {
          DutyRecordsModel.create({
            id: record.id,
            date: record.date,
            person_id: record.personId,
            person_name: record.personName,
            type: record.type || 'auto',
            original_person_id: record.originalPersonId || null,
            reason: record.reason || null,
            created_by: record.createdBy || null
          });
        } catch (error) {
          console.warn(`⚠️ 迁移排班记录 ${record.date} 失败:`, error.message);
        }
      }
      console.log('✅ 排班记录迁移完成');
    }

    // 迁移换班申请
    if (jsonData.swapRequests && Array.isArray(jsonData.swapRequests)) {
      console.log(`🔄 迁移 ${jsonData.swapRequests.length} 个换班申请...`);
      for (const swapRequest of jsonData.swapRequests) {
        try {
          SwapRequestsModel.create({
            id: swapRequest.id,
            from_person_id: swapRequest.fromPersonId,
            to_person_id: swapRequest.toPersonId,
            from_date: swapRequest.fromDate,
            to_date: swapRequest.toDate,
            reason: swapRequest.reason || null
          });
        } catch (error) {
          console.warn(`⚠️ 迁移换班申请失败:`, error.message);
        }
      }
      console.log('✅ 换班申请迁移完成');
    }

    // 迁移请假记录
    if (jsonData.leaveRecords && Array.isArray(jsonData.leaveRecords)) {
      console.log(`🏖️ 迁移 ${jsonData.leaveRecords.length} 个请假记录...`);
      for (const leaveRecord of jsonData.leaveRecords) {
        try {
          LeaveRecordsModel.create({
            id: leaveRecord.id,
            person_id: leaveRecord.personId,
            start_date: leaveRecord.startDate,
            end_date: leaveRecord.endDate,
            reason: leaveRecord.reason || null,
            type: leaveRecord.type || 'other'
          });
        } catch (error) {
          console.warn(`⚠️ 迁移请假记录失败:`, error.message);
        }
      }
      console.log('✅ 请假记录迁移完成');
    }

    // 迁移系统配置
    if (jsonData.startDate) {
      SystemConfigModel.set('start_date', jsonData.startDate);
    }
    if (jsonData.lastUpdated) {
      SystemConfigModel.set('last_updated', jsonData.lastUpdated);
    }
    console.log('✅ 系统配置迁移完成');

    // 迁移排班规则
    if (jsonData.rules) {
      try {
        DutyRulesModel.update({
          max_consecutive_days: jsonData.rules.maxConsecutiveDays || 3,
          min_rest_days: jsonData.rules.minRestDays || 1,
          exclude_weekends: jsonData.rules.excludeWeekends || false,
          exclude_holidays: jsonData.rules.excludeHolidays || false,
          fairness_weight: jsonData.rules.fairnessWeight || 0.8
        });
        console.log('✅ 排班规则迁移完成');
      } catch (error) {
        console.warn(`⚠️ 迁移排班规则失败:`, error.message);
      }
    }

    // 重命名JSON文件为旧文件，保留作备份
    const oldJsonFile = path.join(__dirname, '../data/duty-schedule-old.json');
    await fs.move(JSON_FILE, oldJsonFile);
    
    console.log('🎉 数据迁移完成！');
    console.log(`📁 SQLite数据库已创建`);
    console.log(`📦 原JSON文件已重命名为 duty-schedule-old.json`);
    console.log(`💾 备份文件位于 duty-schedule-backup.json`);

  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
    throw error;
  }
};

// 检查是否需要迁移
const shouldMigrate = async () => {
  const jsonExists = await fs.pathExists(JSON_FILE);
  const dbExists = await fs.pathExists(path.join(__dirname, '../data/duty-schedule.db'));
  
  // 如果有JSON文件但没有数据库文件，则需要迁移
  return jsonExists && !dbExists;
};

// 导出迁移相关函数
module.exports = {
  migrateFromJson,
  shouldMigrate
};

// 如果直接运行此文件，则执行迁移
if (require.main === module) {
  (async () => {
    try {
      if (await shouldMigrate()) {
        await migrateFromJson();
      } else {
        console.log('🔍 检查发现无需迁移数据');
      }
    } catch (error) {
      console.error('❌ 迁移过程出错:', error);
      process.exit(1);
    }
  })();
} 