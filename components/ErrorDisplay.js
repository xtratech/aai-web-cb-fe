'use client';

import React from 'react';

const ErrorDisplay = ({ message }) => (
  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mx-4 mb-2 text-xs" role="alert">
    <p>{message}</p>
  </div>
);

export default ErrorDisplay;
