"use client";

import { useState, useEffect, useCallback } from "react"; // ⬅️ ADD useCallback
import { createClient } from "@/lib/supabase/client";

export function useTelecallerStatus(telecallerIds: string[]) {
  const [telecallerStatus, setTelecallerStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // 1. 🔑 Stabilize the fetch function to ensure it's not the loop source
  const fetchStatus = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setTelecallerStatus({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch attendance records for all telecallers for today
      const { data: attendanceRecords, error } = await supabase
        .from("attendance")
        .select("user_id, check_in")
        .eq("date", today)
        .in("user_id", ids);

      if (error) {
        console.error("Error fetching attendance records:", error);
        setTelecallerStatus({});
        return;
      }

      // Create a map of telecaller ID to checked-in status
      const statusMap: Record<string, boolean> = {};
      ids.forEach(id => {
        statusMap[id] = false; // Default to not checked in
      });

      // Update status for telecallers who have checked in
      attendanceRecords.forEach(record => {
        if (record.check_in) {
          statusMap[record.user_id] = true;
        }
      });

      setTelecallerStatus(statusMap);
    } catch (error) {
      console.error("Error checking telecaller status:", error);
      setTelecallerStatus({});
    } finally {
      setLoading(false);
    }
  }, [supabase]); // Depend on the stable supabase client

  useEffect(() => {
    // Initial data load when IDs change
    fetchStatus(telecallerIds);

    // 2. 🔑 CRITICAL FIX: Set up Real-Time Subscription
    // The subscription listener calls the stable fetchStatus function when data changes.
    const attendanceChannel = supabase
      .channel('telecaller-status')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'attendance',
          // Only listen to records for today's date where check_in or check_out is affected (not possible in Supabase RLS policies, so we listen to everything and filter).
        },
        (payload) => {
          // Re-fetch all data to ensure accuracy after any attendance change
          console.log("Real-time attendance change detected, refreshing status.");
          fetchStatus(telecallerIds);
        }
      )
      .subscribe();
      
    // Cleanup function runs when component unmounts or telecallerIds changes
    return () => {
      supabase.removeChannel(attendanceChannel);
    };
    
  // The effect only runs when the array reference of telecallerIds changes.
  }, [telecallerIds, fetchStatus, supabase]);

  return { telecallerStatus, loading };
}
