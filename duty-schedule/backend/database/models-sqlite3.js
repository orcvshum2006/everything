const { db, dbRun, dbGet, dbAll } = require('./init-sqlite3');
const deasync = require('deasync');

// 创建同步包装器
const syncAll = (sql, params = []) => {
  let result;
  let done = false;
  
  db.all(sql, params, (err, rows) => {
    if (err) throw err;
    result = rows || [];
    done = true;
  });
  
  deasync.loopWhile(() => !done);
  return result;
};

const syncGet = (sql, params = []) => {
  let result;
  let done = false;
  
  db.get(sql, params, (err, row) => {
    if (err) throw err;
    result = row || null;
    done = true;
  });
  
  deasync.loopWhile(() => !done);
  return result;
};

const syncRun = (sql, params = []) => {
  let result;
  let done = false;
  
  db.run(sql, params, function(err) {
    if (err) throw err;
    result = { changes: this.changes, lastID: this.lastID };
    done = true;
  });
  
  deasync.loopWhile(() => !done);
  return result;
};

// 人员管理
class PeopleModel {
  // 获取所有人员
  static getAll() {
    return syncAll('SELECT * FROM people ORDER BY order_index');
  }

  // 根据ID获取人员
  static getById(id) {
    return syncGet('SELECT * FROM people WHERE id = ?', [id]);
  }

  // 添加人员
  static create(data) {
    const { id, name, order_index, is_active = true, email, phone } = data;
    return syncRun(`
      INSERT INTO people (id, name, order_index, is_active, email, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, name, order_index, is_active ? 1 : 0, email, phone]);
  }

  // 更新人员
  static update(id, data) {
    const { name, order_index, is_active, email, phone } = data;
    return syncRun(`
      UPDATE people SET name = ?, order_index = ?, is_active = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, order_index, is_active ? 1 : 0, email, phone, id]);
  }

  // 删除人员
  static delete(id) {
    return syncRun('DELETE FROM people WHERE id = ?', [id]);
  }

  // 批量更新顺序
  static updateOrders(orders) {
    let totalChanges = 0;
    for (const item of orders) {
      const result = syncRun('UPDATE people SET order_index = ? WHERE id = ?', [item.order, item.id]);
      totalChanges += result.changes;
    }
    return { changes: totalChanges };
  }
}

// 排班记录管理
class DutyRecordsModel {
  // 获取所有排班记录
  static getAll() {
    return syncAll('SELECT * FROM duty_records ORDER BY date');
  }

  // 根据日期获取排班记录
  static getByDate(date) {
    return syncGet('SELECT * FROM duty_records WHERE date = ?', [date]);
  }

  // 根据人员ID获取排班记录
  static getByPersonId(personId) {
    return syncAll('SELECT * FROM duty_records WHERE person_id = ? ORDER BY date', [personId]);
  }

  // 获取日期范围内的排班记录
  static getByDateRange(startDate, endDate) {
    return syncAll('SELECT * FROM duty_records WHERE date BETWEEN ? AND ? ORDER BY date', [startDate, endDate]);
  }

  // 添加排班记录
  static create(data) {
    const { id, date, person_id, person_name, type, original_person_id, reason, created_by, created_at } = data;
    const finalCreatedAt = created_at || new Date().toISOString();
    return syncRun(`
      INSERT INTO duty_records (id, date, person_id, person_name, type, original_person_id, reason, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, date, person_id, person_name, type, original_person_id, reason, created_by, finalCreatedAt]);
  }

  // 更新排班记录
  static update(id, data) {
    const { person_id, person_name, type, original_person_id, reason } = data;
    return syncRun(`
      UPDATE duty_records SET person_id = ?, person_name = ?, type = ?, original_person_id = ?, reason = ?
      WHERE id = ?
    `, [person_id, person_name, type, original_person_id, reason, id]);
  }

  // 删除排班记录
  static delete(id) {
    return syncRun('DELETE FROM duty_records WHERE id = ?', [id]);
  }

  // 按日期删除排班记录
  static deleteByDate(date) {
    return syncRun('DELETE FROM duty_records WHERE date = ?', [date]);
  }

  // 删除人员的所有排班记录
  static deleteByPersonId(personId) {
    return syncRun('DELETE FROM duty_records WHERE person_id = ?', [personId]);
  }

  // 批量插入排班记录
  static createMany(records) {
    let totalChanges = 0;
    for (const record of records) {
      const finalCreatedAt = record.created_at || new Date().toISOString();
      const result = syncRun(`
        INSERT OR REPLACE INTO duty_records (id, date, person_id, person_name, type, original_person_id, reason, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [record.id, record.date, record.person_id, record.person_name, 
          record.type, record.original_person_id, record.reason, record.created_by, finalCreatedAt]);
      totalChanges += result.changes;
    }
    return { changes: totalChanges };
  }
}

// 换班申请管理
class SwapRequestsModel {
  // 获取所有换班申请
  static getAll() {
    return syncAll('SELECT * FROM swap_requests ORDER BY created_at DESC');
  }

  // 根据状态获取换班申请
  static getByStatus(status) {
    return syncAll('SELECT * FROM swap_requests WHERE status = ? ORDER BY created_at DESC', [status]);
  }

  // 添加换班申请
  static create(data) {
    const { id, from_person_id, to_person_id, from_date, to_date, reason } = data;
    return syncRun(`
      INSERT INTO swap_requests (id, from_person_id, to_person_id, from_date, to_date, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, from_person_id, to_person_id, from_date, to_date, reason]);
  }

  // 更新换班申请状态
  static updateStatus(id, status) {
    const approved_at = status === 'approved' ? new Date().toISOString() : null;
    return syncRun(`
      UPDATE swap_requests SET status = ?, approved_at = ? WHERE id = ?
    `, [status, approved_at, id]);
  }

  // 删除换班申请
  static delete(id) {
    return syncRun('DELETE FROM swap_requests WHERE id = ?', [id]);
  }
}

// 请假记录管理
class LeaveRecordsModel {
  // 获取所有请假记录
  static getAll() {
    return syncAll('SELECT * FROM leave_records ORDER BY start_date');
  }

  // 根据人员ID获取请假记录
  static getByPersonId(personId) {
    return syncAll('SELECT * FROM leave_records WHERE person_id = ? ORDER BY start_date', [personId]);
  }

  // 获取日期范围内的请假记录
  static getByDateRange(startDate, endDate) {
    return syncAll(`
      SELECT * FROM leave_records 
      WHERE (start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?)
      ORDER BY start_date
    `, [endDate, startDate, startDate, endDate]);
  }

  // 添加请假记录
  static create(data) {
    const { id, person_id, start_date, end_date, reason, type } = data;
    return syncRun(`
      INSERT INTO leave_records (id, person_id, start_date, end_date, reason, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, person_id, start_date, end_date, reason, type]);
  }

  // 删除请假记录
  static delete(id) {
    return syncRun('DELETE FROM leave_records WHERE id = ?', [id]);
  }
}

// 系统配置管理
class SystemConfigModel {
  // 获取配置
  static get(key) {
    const result = syncGet('SELECT value FROM system_config WHERE key = ?', [key]);
    return result ? result.value : null;
  }

  // 设置配置
  static set(key, value) {
    return syncRun(`
      INSERT OR REPLACE INTO system_config (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [key, value]);
  }

  // 获取所有配置
  static getAll() {
    return syncAll('SELECT * FROM system_config');
  }
}

// 排班规则管理
class DutyRulesModel {
  // 获取排班规则
  static get() {
    return syncGet('SELECT * FROM duty_rules WHERE id = 1');
  }

  // 更新排班规则
  static update(data) {
    const { max_consecutive_days, min_rest_days, exclude_weekends, exclude_holidays, fairness_weight } = data;
    return syncRun(`
      UPDATE duty_rules SET 
        max_consecutive_days = ?, 
        min_rest_days = ?, 
        exclude_weekends = ?, 
        exclude_holidays = ?, 
        fairness_weight = ?, 
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = 1
    `, [max_consecutive_days, min_rest_days, exclude_weekends ? 1 : 0, exclude_holidays ? 1 : 0, fairness_weight]);
  }
}

module.exports = {
  PeopleModel,
  DutyRecordsModel,
  SwapRequestsModel,
  LeaveRecordsModel,
  SystemConfigModel,
  DutyRulesModel
}; 