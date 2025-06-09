const { db } = require('./init');

// 人员管理
class PeopleModel {
  // 获取所有人员
  static getAll() {
    return db.prepare('SELECT * FROM people ORDER BY order_index').all();
  }

  // 根据ID获取人员
  static getById(id) {
    return db.prepare('SELECT * FROM people WHERE id = ?').get(id);
  }

  // 添加人员
  static create(data) {
    const { id, name, order_index, is_active = true, email, phone } = data;
    return db.prepare(`
      INSERT INTO people (id, name, order_index, is_active, email, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, order_index, is_active ? 1 : 0, email, phone);
  }

  // 更新人员
  static update(id, data) {
    const { name, order_index, is_active, email, phone } = data;
    return db.prepare(`
      UPDATE people SET name = ?, order_index = ?, is_active = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, order_index, is_active ? 1 : 0, email, phone, id);
  }

  // 删除人员
  static delete(id) {
    return db.prepare('DELETE FROM people WHERE id = ?').run(id);
  }

  // 批量更新顺序
  static updateOrders(orders) {
    const updateStmt = db.prepare('UPDATE people SET order_index = ? WHERE id = ?');
    const transaction = db.transaction((items) => {
      for (const item of items) {
        updateStmt.run(item.order, item.id);
      }
    });
    return transaction(orders);
  }
}

// 排班记录管理
class DutyRecordsModel {
  // 获取所有排班记录
  static getAll() {
    return db.prepare('SELECT * FROM duty_records ORDER BY date').all();
  }

  // 根据日期获取排班记录
  static getByDate(date) {
    return db.prepare('SELECT * FROM duty_records WHERE date = ?').get(date);
  }

  // 根据人员ID获取排班记录
  static getByPersonId(personId) {
    return db.prepare('SELECT * FROM duty_records WHERE person_id = ? ORDER BY date').all(personId);
  }

  // 获取日期范围内的排班记录
  static getByDateRange(startDate, endDate) {
    return db.prepare('SELECT * FROM duty_records WHERE date BETWEEN ? AND ? ORDER BY date').all(startDate, endDate);
  }

  // 添加排班记录
  static create(data) {
    const { id, date, person_id, person_name, type, original_person_id, reason, created_by, created_at } = data;
    // 如果没有提供created_at，使用当前时间
    const finalCreatedAt = created_at || new Date().toISOString();
    return db.prepare(`
      INSERT INTO duty_records (id, date, person_id, person_name, type, original_person_id, reason, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, date, person_id, person_name, type, original_person_id, reason, created_by, finalCreatedAt);
  }

  // 更新排班记录
  static update(id, data) {
    const { person_id, person_name, type, original_person_id, reason } = data;
    return db.prepare(`
      UPDATE duty_records SET person_id = ?, person_name = ?, type = ?, original_person_id = ?, reason = ?
      WHERE id = ?
    `).run(person_id, person_name, type, original_person_id, reason, id);
  }

  // 删除排班记录
  static delete(id) {
    return db.prepare('DELETE FROM duty_records WHERE id = ?').run(id);
  }

  // 按日期删除排班记录
  static deleteByDate(date) {
    return db.prepare('DELETE FROM duty_records WHERE date = ?').run(date);
  }

  // 删除人员的所有排班记录
  static deleteByPersonId(personId) {
    return db.prepare('DELETE FROM duty_records WHERE person_id = ?').run(personId);
  }

  // 批量插入排班记录
  static createMany(records) {
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO duty_records (id, date, person_id, person_name, type, original_person_id, reason, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const transaction = db.transaction((items) => {
      for (const record of items) {
        const finalCreatedAt = record.created_at || new Date().toISOString();
        insertStmt.run(
          record.id, record.date, record.person_id, record.person_name, 
          record.type, record.original_person_id, record.reason, record.created_by, finalCreatedAt
        );
      }
    });
    return transaction(records);
  }
}

// 换班申请管理
class SwapRequestsModel {
  // 获取所有换班申请
  static getAll() {
    return db.prepare('SELECT * FROM swap_requests ORDER BY created_at DESC').all();
  }

  // 根据状态获取换班申请
  static getByStatus(status) {
    return db.prepare('SELECT * FROM swap_requests WHERE status = ? ORDER BY created_at DESC').all(status);
  }

  // 添加换班申请
  static create(data) {
    const { id, from_person_id, to_person_id, from_date, to_date, reason } = data;
    return db.prepare(`
      INSERT INTO swap_requests (id, from_person_id, to_person_id, from_date, to_date, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, from_person_id, to_person_id, from_date, to_date, reason);
  }

  // 更新换班申请状态
  static updateStatus(id, status) {
    const approved_at = status === 'approved' ? new Date().toISOString() : null;
    return db.prepare(`
      UPDATE swap_requests SET status = ?, approved_at = ? WHERE id = ?
    `).run(status, approved_at, id);
  }

  // 删除换班申请
  static delete(id) {
    return db.prepare('DELETE FROM swap_requests WHERE id = ?').run(id);
  }
}

// 请假记录管理
class LeaveRecordsModel {
  // 获取所有请假记录
  static getAll() {
    return db.prepare('SELECT * FROM leave_records ORDER BY start_date').all();
  }

  // 根据人员ID获取请假记录
  static getByPersonId(personId) {
    return db.prepare('SELECT * FROM leave_records WHERE person_id = ? ORDER BY start_date').all(personId);
  }

  // 获取日期范围内的请假记录
  static getByDateRange(startDate, endDate) {
    return db.prepare(`
      SELECT * FROM leave_records 
      WHERE (start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?)
      ORDER BY start_date
    `).all(endDate, startDate, startDate, endDate);
  }

  // 添加请假记录
  static create(data) {
    const { id, person_id, start_date, end_date, reason, type } = data;
    return db.prepare(`
      INSERT INTO leave_records (id, person_id, start_date, end_date, reason, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, person_id, start_date, end_date, reason, type);
  }

  // 删除请假记录
  static delete(id) {
    return db.prepare('DELETE FROM leave_records WHERE id = ?').run(id);
  }
}

// 系统配置管理
class SystemConfigModel {
  // 获取配置
  static get(key) {
    const result = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key);
    return result ? result.value : null;
  }

  // 设置配置
  static set(key, value) {
    return db.prepare(`
      INSERT OR REPLACE INTO system_config (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(key, value);
  }

  // 获取所有配置
  static getAll() {
    return db.prepare('SELECT * FROM system_config').all();
  }
}

// 排班规则管理
class DutyRulesModel {
  // 获取排班规则
  static get() {
    return db.prepare('SELECT * FROM duty_rules WHERE id = 1').get();
  }

  // 更新排班规则
  static update(data) {
    const { max_consecutive_days, min_rest_days, exclude_weekends, exclude_holidays, fairness_weight } = data;
    return db.prepare(`
      UPDATE duty_rules SET 
        max_consecutive_days = ?, 
        min_rest_days = ?, 
        exclude_weekends = ?, 
        exclude_holidays = ?, 
        fairness_weight = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(max_consecutive_days, min_rest_days, exclude_weekends ? 1 : 0, exclude_holidays ? 1 : 0, fairness_weight);
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