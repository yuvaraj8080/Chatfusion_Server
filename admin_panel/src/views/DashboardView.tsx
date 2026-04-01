import React from "react";
import { useOrderController } from "../controllers/OrderController";
import { OrderCard } from "./components/OrderCard";
import { LogOut, Activity } from "lucide-react";

interface Props {
  onLogout: () => void;
}

export const DashboardView: React.FC<Props> = ({ onLogout }) => {
  const { orders, loading, approveOrder } = useOrderController();

  return (
    <div className="dashboard-container">
      <header className="dash-header glass">
        <div className="top-bar">
          <h2>
            <Activity size={24} className="icon-pulse" /> Orders
          </h2>
          <button onClick={onLogout} className="btn-icon">
            <LogOut size={20} />
          </button>
        </div>
        <p className="subtitle">Manage user subscriptions</p>
      </header>

      <div className="orders-list">
        {loading ? (
          <div className="loader">Loading Orders...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">No Orders Found</div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order._id}
              order={order}
              onApprove={approveOrder}
            />
          ))
        )}
      </div>
    </div>
  );
};
