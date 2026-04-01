import React from "react";
import type { Order } from "../../models/OrderModel";
import { CheckCircle2, IndianRupee, User, Info, Calendar } from "lucide-react";

interface Props {
  order: Order;
  onApprove: (id: string) => void;
}

export const OrderCard: React.FC<Props> = ({ order, onApprove }) => {
  const isApproved = order.isApproved;

  return (
    <div className={`order-card ${isApproved ? "approved" : "pending"}`}>
      <div className="order-header">
        <div className="order-id">
          <Info size={14} className="icon-subtle" />
          <p>{order._id.substring(0, 10)}...</p>
        </div>
        <div className={`status-badge ${order.transactionStatus.toLowerCase()}`}>
          {order.transactionStatus}
        </div>
      </div>

      <div className="order-body">
        <div className="info-row">
          <User size={16} className="icon" />
          <span className="label">User ID:</span>
          <span className="value truncate">{order.user}</span>
        </div>

        <div className="info-row">
          <IndianRupee size={16} className="icon green-text" />
          <span className="label">Amount:</span>
          <span className="value price">{order.totalAmount}</span>
        </div>

        <div className="info-row">
          <Calendar size={16} className="icon" />
          <span className="label">Created At:</span>
          <span className="value">{new Date(order.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="info-row">
          <Info size={16} className="icon" />
          <span className="label">Plan:</span>
          <span className="value">{order.transactionFor}</span>
        </div>
      </div>

      <div className="order-footer">
        <button
          className={`btn-approve ${isApproved ? "active" : ""}`}
          onClick={() => onApprove(order._id)}
        >
          <CheckCircle2 size={20} />
          {isApproved ? "Approved" : "Approve Order"}
        </button>
      </div>
    </div>
  );
};
