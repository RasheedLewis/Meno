import { ChatPane } from "@/components/ChatPane/ChatPane";
import { UploadBox } from "@/components/Problem/UploadBox";

export default function ChatDemoPage() {
  return (
    <div className="flex flex-col items-center gap-8">
      <ChatPane className="mt-6" />
      <UploadBox className="w-full max-w-3xl" />
    </div>
  );
}

