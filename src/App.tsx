/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import GlobalRoutes from './routes/globalRoutes';
import { BrowserRouter } from 'react-router-dom';
import NotificationCenter from './components/NotificationCenter';

export default function App() {
  return (
    <BrowserRouter>
      <GlobalRoutes />
      <NotificationCenter />
    </BrowserRouter>
  );
}
