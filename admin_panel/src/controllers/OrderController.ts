import { useState, useEffect, useCallback } from "react";
import type { Order } from "../models/OrderModel";

export const useOrderController = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real order data from the backend API
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:6010'}/api/transaction/getTransactions`);
      const data = await response.json();
      if (data.success) {
        setOrders(data.result);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const approveOrder = useCallback((orderId: string) => {
    setOrders(prevOrders => {
      return prevOrders.map(order => {
        if (order._id === orderId) {
          const newApprovalState = !order.isApproved;

          // Update the real database asynchronously
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:6010'}/api/transaction/approve/${orderId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isApproved: newApprovalState })
          }).catch(err => console.error("Realtime database update failed:", err));

          return { ...order, isApproved: newApprovalState };
        }
        return order;
      });
    });
  }, []);

  return { orders, loading, approveOrder };
};
