import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ToolsTab from './components/Tabs/ToolsTab';
import ToolDetail from './components/ToolDetail';
import MetricsTab from './components/Tabs/MetricsTab';
import ToolFlowTab from './components/Tabs/ToolFlowTab';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<ToolsTab />} />
        <Route path="tools/:toolName" element={<ToolDetail />} />
        <Route path="metrics" element={<MetricsTab />} />
        <Route path="flow" element={<ToolFlowTab />} />
      </Route>
    </Routes>
  );
};

export default App;
