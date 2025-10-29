import React from "react"
import { View } from "react-native"

interface PaginationDotsProps {
  total: number
  currentIndex: number
  activeColor?: string
  inactiveColor?: string
}

export const PaginationDots: React.FC<PaginationDotsProps> = ({
  total,
  currentIndex,
  activeColor = "#007aff",
  inactiveColor = "#d1d1d6",
}) => {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        paddingVertical: 12,
        gap: 8,
      }}
    >
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: currentIndex === index ? activeColor : inactiveColor,
          }}
        />
      ))}
    </View>
  )
}
