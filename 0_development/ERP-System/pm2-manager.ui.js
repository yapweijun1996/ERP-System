import { pad } from './pm2-manager.format.js';

export function actionHint(row) {
  if (row.status === 'missing') return row.hasStartArgs ? '可启动' : '需配置 startArgs';
  if (row.status === 'online' || row.status === 'launching') return '运行中';
  if (row.status === 'stopped') return '已停止';
  if (row.status === 'errored') return '异常';
  return '未知';
}

export function renderSimpleMenu({ rows, lastMessage, clearScreen, mode }) {
  if (clearScreen) console.clear();
  console.log('PM2 Manager');
  if (mode) console.log(`模式：${mode}`);
  if (lastMessage) console.log(`上次操作：${lastMessage}`);
  console.log('');
  console.log('指令：a=start all | s=stop all | r=restart all | d=delete all(确认) | m=切换模式 | q=quit');
  console.log('');
  console.log(`${pad('#', 3, 'right')} ${pad('name', 20)} ${pad('status', 10)} ${pad('说明', 10)} ${pad('URL', 25)}`);
  rows.forEach((r, idx) => {
    console.log(
      `${pad(idx + 1, 3, 'right')} ${pad(r.name, 20)} ${pad(r.status, 10)} ${pad(r.hint, 10)} ${pad(r.url, 25)}`,
    );
  });
  if (rows.length === 0) console.log('（空）');
  console.log('');
}
