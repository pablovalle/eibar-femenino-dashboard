import React from 'react';
import {createRoot} from 'react-dom/client';
import StaffApp from '../components/staff-app';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(<StaffApp localEdition/>);
