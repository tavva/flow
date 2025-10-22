import React from "react";

export const Box: React.FC<any> = ({ children }) => {
  return <div data-component="Box">{children}</div>;
};

export const Text: React.FC<any> = ({ children, color }) => {
  return (
    <span data-component="Text" data-color={color}>
      {children}
    </span>
  );
};

export const useInput = jest.fn();

export const render = jest.fn();
