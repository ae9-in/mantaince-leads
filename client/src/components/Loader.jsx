import React from 'react';

/**
 * Smooth 9-square grid loader animation
 */
export const Loader = ({ small }) => {
  return (
    <div className={`custom-loader-container ${small ? 'small' : ''}`}>
      <div className="custom-loader-square" id="sq1"></div>
      <div className="custom-loader-square" id="sq2"></div>
      <div className="custom-loader-square" id="sq3"></div>
      <div className="custom-loader-square" id="sq4"></div>
      <div className="custom-loader-square" id="sq5"></div>
      <div className="custom-loader-square" id="sq6"></div>
      <div className="custom-loader-square" id="sq7"></div>
      <div className="custom-loader-square" id="sq8"></div>
      <div className="custom-loader-square" id="sq9"></div>
    </div>
  );
};

export default Loader;
