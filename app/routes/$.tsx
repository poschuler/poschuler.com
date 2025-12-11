import { Unplug } from "lucide-react";
import { data } from "react-router";

export async function loader() {
  return data(null, { status: 404 });
}

export default function Component() {
  return (
    <div className="flex flex-col w-screen h-screen justify-center items-center text-xl font-medium leading-none">
      <Unplug className="w-14 h-14" />
      <h1 className="mt-5">404 - Not Found</h1>
    </div>
  );
}
