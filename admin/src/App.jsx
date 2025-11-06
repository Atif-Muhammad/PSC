import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/AuthPage";
import Dashboad from "./pages/Dashboard"
import DataScreen from "./pages/DataScreen";
import Layout from "./components/Layout";
import {useQuery} from "@tanstack/react-query"
import { userWho } from "../config/apis";

function App() {
  const {data: currentUser} = useQuery({
    queryKey: ["currentUser"],
    queryFn: userWho,
    enabled: true
  })

  return (
    <BrowserRouter>
      <Routes>
        {currentUser?.id ? (
          <Route element={<Layout currentRole={currentUser?.role} />}>
            <Route path="/" element={<Dashboad />} />
            <Route path="/data/:for" element={<DataScreen currentRole={currentUser?.role} id={currentUser?.id}/>} />
            <Route path="*" element={<Navigate to="/" replace/>}/>
          </Route>
        ) : (
          <>
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
