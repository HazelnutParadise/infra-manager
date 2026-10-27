---
version: alpha
name: 基礎設施管理系統
colors:
  primary: "#276b51"
  secondary: "#173c2e"
  neutral: "#f4f6f5"
typography:
  body-md:
    fontFamily: system-ui
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: 6px
  md: 8px
spacing:
  sm: 8px
  md: 16px
  lg: 32px
---

## Overview

管理者使用的存取管理介面。優先呈現待處理事項、真實資料與可辨識的操作結果。

## Colors

深綠用於導覽，綠色用於主要操作；中性色背景搭配白色內容區。狀態色搭配文字使用。

## Typography

介面採用系統無襯線字體，標題以字重與大小建立層級，表格保持可讀的密度。

## Layout

桌面以固定側欄搭配流動主內容；窄螢幕將導覽移至上方，表格可橫向捲動。

## Elevation & Depth

以細邊框分隔內容，避免無意義的陰影及浮動效果。

## Shapes

操作與內容區使用 6 至 8 像素圓角。

## Components

表格、篩選器、表單與狀態提示沿用共同間距與字級。載入、空資料與錯誤狀態必須明示。

## Do's and Don'ts

使用真實資料與明確時間範圍。不得將服務啟用狀態當作健康檢查，不顯示無來源的趨勢。
