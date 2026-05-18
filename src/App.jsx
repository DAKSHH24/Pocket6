import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Tables from './pages/Tables';
import FoodDrinks from './pages/FoodDrinks';
import Expenses from './pages/Expenses';
import Analytics from './pages/Analytics';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/tables" replace />} />
        <Route path="tables" element={<Tables />} />
        <Route path="food" element={<FoodDrinks />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
    </Routes>
  );
}

export default App;
