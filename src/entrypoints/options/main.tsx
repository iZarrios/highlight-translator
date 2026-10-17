import ReactDOM from 'react-dom/client';
import '@/styles/base.css';
import { OptionsApp } from '@/entrypoints/options/options-app';

const root = document.getElementById('root');
if (!root) throw new Error('Options root element was not found.');

ReactDOM.createRoot(root).render(<OptionsApp />);
