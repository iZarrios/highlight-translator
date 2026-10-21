import ReactDOM from 'react-dom/client';
import '@/ui/base.css';
import { HistoryApp } from '@/ui/entrypoints/sidepanel/history-app';

const root = document.getElementById('root');
if (!root) throw new Error('History root element was not found.');

ReactDOM.createRoot(root).render(<HistoryApp />);
