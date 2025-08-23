/**
 * 設備狀態管理切片
 * 
 * 負責管理設備選擇、批次執行結果等設備相關狀態
 * 
 * @description 此切片專注於設備相關的狀態管理，包括選中的設備列表和批次執行結果
 * @author AI Ops Assistant  
 * @version 1.0.0 - 初始切片版本
 */
import { type StateCreator } from 'zustand';
import { type AppStore, type DeviceSlice } from '@/types/store';

// 設備切片初始狀態
export const initialDeviceState = {
  selectedDevices: [],
  batchResults: [],
} as const;

export const createDeviceSlice: StateCreator<
  AppStore,
  [],
  [],
  DeviceSlice
> = (set) => ({
  // 初始狀態
  ...initialDeviceState,

  // 設備選擇動作
  setSelectedDevices: (deviceIps) => {
    set({ selectedDevices: deviceIps }, false, 'device:setSelectedDevices');
  },

  // 批次結果動作
  setBatchResults: (results) => {
    set({ batchResults: results }, false, 'device:setBatchResults');
  },
});