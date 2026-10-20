// 模块注册表：现在全部功能合并进唯一一个模块（learn），由它内部 subnav 切换子视图
import learn from './learn.js';

const RAW = [learn];

// 底部 Tab 用的短名（单模块时不会用到，保留兼容）
const SHORT = { learn: '西语' };

export const MODULES = RAW.map(m => ({ ...m, short: m.short || SHORT[m.id] || m.name }));
export default MODULES;
