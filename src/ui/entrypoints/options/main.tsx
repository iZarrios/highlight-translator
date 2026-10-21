import ReactDOM from 'react-dom/client';
import '@/ui/base.css';
import { OptionsApp } from '@/ui/entrypoints/options/options-app';

const root = document.getElementById('root');
if (!root) throw new Error('Options root element was not found.');

ReactDOM.createRoot(root).render(<OptionsApp />);
