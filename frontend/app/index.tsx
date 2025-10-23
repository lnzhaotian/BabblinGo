import { Text, View } from "react-native";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { config } from '../lib/config';

export default function Index() {
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(`${config.apiUrl}/api`)
      .then((response) => {
        setData(response.data);
      })
      .catch((error) => {
        console.error("Error fetching data from API:", error);
      });
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>{data}</Text>
    </View>
  );
}
