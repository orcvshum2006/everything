import { useState } from 'react';
import type { Person } from '../../types';
import styles from './PersonManager.module.css';

interface PersonManagerProps {
  people: Person[];
  onAddPerson: (name: string) => void;
  onRemovePerson: (id: string) => void;
  onMovePersonUp: (id: string) => void;
  onMovePersonDown: (id: string) => void;
}

const PersonManager: React.FC<PersonManagerProps> = ({
  people,
  onAddPerson,
  onRemovePerson,
  onMovePersonUp,
  onMovePersonDown
}) => {
  const [newPersonName, setNewPersonName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPersonName.trim()) {
      onAddPerson(newPersonName.trim());
      setNewPersonName('');
    }
  };

  // 确保数据正确排序
  const sortedPeople = [...people].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.personManager}>
      <h3>👥 值班人员管理</h3>
      
      <form onSubmit={handleSubmit} className={styles.addPersonForm}>
        <input
          type="text"
          value={newPersonName}
          onChange={(e) => setNewPersonName(e.target.value)}
          placeholder="输入姓名"
          className={styles.nameInput}
          autoComplete="off"
        />
        <button type="submit" className={styles.addButton} disabled={!newPersonName.trim()}>
          添加
        </button>
      </form>

      <div className={styles.peopleList}>
        {sortedPeople.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>👥</div>
            <p className={styles.emptyMessage}>还没有添加值班人员</p>
            <p className={styles.emptyHint}>在上方输入框添加第一位值班人员</p>
          </div>
        ) : (
          <>
            <div className={styles.listHeader}>
              <span>当前共有 {sortedPeople.length} 位值班人员</span>
            </div>
            {sortedPeople.map((person, index) => (
              <div key={person.id} className={styles.personItem}>
                <div className={styles.personInfo}>
                  <span className={styles.personOrder}>#{person.order}</span>
                  <span className={styles.personName} title={person.name}>
                    {person.name || '未设置姓名'}
                  </span>
                  <span className={styles.personStatus}>
                    {person.isActive !== false ? '✅ 活跃' : '❌ 停用'}
                  </span>
                </div>
                <div className={styles.personActions}>
                  <button
                    onClick={() => onMovePersonUp(person.id)}
                    disabled={index === 0}
                    className={`${styles.moveButton} ${styles.upButton}`}
                    title="向上移动"
                    aria-label={`将 ${person.name} 向上移动`}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => onMovePersonDown(person.id)}
                    disabled={index === sortedPeople.length - 1}
                    className={`${styles.moveButton} ${styles.downButton}`}
                    title="向下移动"
                    aria-label={`将 ${person.name} 向下移动`}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => {
                      const personName = person.name || '此人员';
                      if (window.confirm(`确定要删除 ${personName} 吗？`)) {
                        onRemovePerson(person.id);
                      }
                    }}
                    className={styles.removeButton}
                    title="删除人员"
                    aria-label={`删除 ${person.name || '此人员'}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 操作提示 */}
      {sortedPeople.length > 0 && (
        <div className={styles.tips}>
          <div className={styles.tip}>
            💡 <strong>提示：</strong>使用↑↓按钮调整值班顺序，顺序决定了轮值的先后
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonManager; 