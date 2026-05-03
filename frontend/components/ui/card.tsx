import React from 'react';
export const Card = ({ children, className }: any) => <div className={className}>{children}</div>;
export const CardHeader = ({ children, className }: any) => <div className={className}>{children}</div>;
export const CardTitle = ({ children, className }: any) => <h2 className={className}>{children}</h2>;
export const CardContent = ({ children, className }: any) => <div className={className}>{children}</div>;
