import { HiPlus } from "react-icons/hi";
import Button from "@/components/common/Button";
import { LuPanelLeft } from "react-icons/lu";
import { useAppContext } from "@/components/AppContext";
import { MdDarkMode, MdInfo, MdLightMode } from "react-icons/md";
import { ActionType } from "@/reducer/AppReducer";

export default function Toolbar() {
  const {
    state: { themeMode },
    dispatch,
  } = useAppContext();
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-800 flex p-2 justify-between">
      <Button
        icon={themeMode === "dark" ? MdDarkMode : MdLightMode}
        variant="text"
        onClick={() => {
          dispatch({
            type: ActionType.UPDATE,
            field: "themeMode",
            value: themeMode === "dark" ? "light" : "dark",
          });
        }}
      />

      <Button icon={MdInfo} variant="text" />
    </div>
  );
}
