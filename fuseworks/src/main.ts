import './ui/styles.css';
import { App } from './ui/app';

const app = new App();
app.boot();
// exposed for automated end-to-end tests and debugging only
(window as unknown as { __fuseworks: App }).__fuseworks = app;
