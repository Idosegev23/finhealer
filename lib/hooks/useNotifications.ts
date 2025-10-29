"use client"

import { useEffect, useState, useCallback, useRef } from 'react';

export interface Notification {
  type: 'document_processed';
  statementId: string;
  transactionsCount: number;
  processedAt: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // ניקוי חיבור קיים
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource('/api/notifications/sse');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connected');
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const notification: Notification = JSON.parse(event.data);
          console.log('Notification received:', notification);
          setNotifications((prev) => [...prev, notification]);
        } catch (error) {
          console.error('Error parsing notification:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setIsConnected(false);
        eventSource.close();
        
        // ניסיון חיבור מחדש אחרי 5 שניות
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 5000);
      };
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();

    // ניקוי בעת unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const clearNotification = useCallback((statementId: string) => {
    setNotifications((prev) =>
      prev.filter((n) => n.statementId !== statementId)
    );
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    isConnected,
    clearNotification,
    clearAllNotifications,
  };
}

