import React from 'react';
import { BarChart, Bar, Tooltip, ResponsiveContainer, XAxis } from 'recharts';

const SparklineBar = ({ data }) => {
  if (!data || data.length === 0) return <span>—</span>;

  // Transform to [{ step: 1, count: 3 }, ...]
  const sparkData = Object.entries(data).map(([step, count]) => ({
    step: `S${step}`,
    count,
  }));

  return (
    <div style={{ width: 100, height: 30 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sparkData}>
          <Tooltip
            contentStyle={{ fontSize: '0.75rem' }}
            labelFormatter={(label) => `Step ${label.replace('S', '')}`}
            formatter={(val) => [`${val} calls`, '']}
          />
          <XAxis dataKey="step" hide />
          <Bar dataKey="count" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SparklineBar;
