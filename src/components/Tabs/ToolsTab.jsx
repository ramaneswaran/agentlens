import React, { useEffect, useState } from 'react';
import { loadCSVData, getAllToolStats } from '../../utils/dataProcessing';
import { Table, Form, InputGroup } from 'react-bootstrap';
import SparklineBar from '../SparklineBar';
import { useNavigate } from 'react-router-dom';


const ToolsTab = () => {
  const navigate = useNavigate();
  const [toolStats, setToolStats] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('count');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    loadCSVData('/agent_metrics.csv')
      .then(data => {
        const stats = getAllToolStats(data);
        setToolStats(stats);
      })
      .catch(err => console.error('Data load error:', err));
  }, []);

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const filteredStats = toolStats
    .filter(tool =>
      tool.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

  const renderSortIcon = (key) => {
    if (key !== sortKey) return null;
    return sortOrder === 'asc' ? ' 🔼' : ' 🔽';
  };

  return (
    <div className="p-2">
      <h4 className="mb-3">🔍 Tool List</h4>

      <InputGroup className="mb-3">
        <Form.Control
          type="text"
          placeholder="Search tools..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </InputGroup>

      <div className="table-responsive">
        <Table striped bordered hover size="sm" className="align-middle">
          <thead className="table-light">
            <tr>
              <th onClick={() => handleSort('name')}>Tool Name{renderSortIcon('name')}</th>
              <th onClick={() => handleSort('count')}>Count{renderSortIcon('count')}</th>
              <th onClick={() => handleSort('avgDuration')}>Avg Duration (ms){renderSortIcon('avgDuration')}</th>
              <th onClick={() => handleSort('errorRate')}>Error Rate{renderSortIcon('errorRate')}</th>
              <th onClick={() => handleSort('avgTokens')}>Avg Tokens{renderSortIcon('avgTokens')}</th>
              <th onClick={() => handleSort('useCases')}>Use Cases{renderSortIcon('useCases')}</th>
              <th>Step Distribution</th>
            </tr>
          </thead>
          <tbody>
            {filteredStats.map(tool => (
                <tr key={tool.name} onClick={() => navigate(`/tools/${tool.name}`)} style={{ cursor: 'pointer' }}>
                <td>{tool.name}</td>
                <td>{tool.count}</td>
                <td>{tool.avgDuration.toFixed(2)}</td>
                <td>{(tool.errorRate * 100).toFixed(1)}%</td>
                <td>{Math.round(tool.avgTokens)}</td>
                <td>{tool.useCases}</td>
                <td><SparklineBar data={tool.stepDistribution} /></td>
                </tr>
            ))}
            </tbody>
        </Table>
      </div>
    </div>
  );
};

export default ToolsTab;
