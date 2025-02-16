import { useAppContext } from "@/components/AppContext";
import Button from "@/components/common/Button";
import { useEventBusContext } from "@/components/EventBusContext";
import { ActionType } from "@/reducer/AppReducer";
import { Message, MessageRequestBody } from "@/types/chat";
import { useRef, useState } from "react";
import { FiSend } from "react-icons/fi";
import { MdRefresh } from "react-icons/md";
import { PiLightningFill, PiStopBold } from "react-icons/pi";
import TextareaAutosize from "react-textarea-autosize";

export default function ChatInput() {
  const [messageText, setMessageText] = useState("");
  const {
    state: { currentModel, messageList, streamingId },
    dispatch,
  } = useAppContext();
  const { subscribe, unsubscribe, publish } = useEventBusContext();

  // 控制停止生成. 使用useRef而不是useState的原因：
  // 1. useRef 的值改变不会导致组件重新渲染，而 useState 的值改变会触发重渲染
  // 2. 在异步操作中保持最新值. 如果使用 useState，在异步操作中可能会捕获到旧的状态值（闭包陷阱）useRef 的 .current 属性总是能获取到最新的值
  // 3. 跨渲染周期保持值. useRef 在组件的整个生命周期中保持不变，即使组件重新渲染

  const stopRef = useRef(false);
  const chatIdRef = useRef("");

  async function createOrUpdateMessage(message: Message) {
    const response = await fetch("/api/message/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      console.log(response.statusText);
      return;
    }
    const { data } = await response.json();
    if (!chatIdRef.current) {
      // 新对话 发送通知刷新对话列表
      chatIdRef.current = data.message.chatId;
      publish("fetchChatList");
    }
    return data.message;
  }

  async function deleteMessage(id: string) {
    const response = await fetch(`/api/message/delete?id=${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      console.log(response.statusText);
      return false;
    }
    const { code } = await response.json();
    return code === 0;
  }

  async function send() {
    const message = await createOrUpdateMessage({
      id: "",
      role: "user",
      content: messageText,
      chatId: chatIdRef.current,
    });
    dispatch({
      type: ActionType.ADD_MESSAGE,
      message: message,
    });
    const messages = messageList.concat([message]);
    doSend(messages);
  }

  async function resend() {
    const messages = [...messageList];
    if (
      messages.length !== 0 &&
      messages[messages.length - 1].role === "assistant"
    ) {
      const result = await deleteMessage(messages[messages.length - 1].id);
      if (!result) {
        console.log("detele error");
        return;
      }
      dispatch({
        type: ActionType.REMOVE_MESSAGE,
        message: messages[messages.length - 1],
      });
      messages.splice(messages.length - 1, 1);
    }
    doSend(messages);
  }

  async function doSend(messages: Message[]) {
    setMessageText("");
    const body: MessageRequestBody = {
      messages: messages,
      model: currentModel,
    };
    // 定义一个controller用于手动中止正在进行的网络请求（流式响应）
    const controller = new AbortController();
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.log(response.statusText);
      return;
    }
    if (!response.body) {
      console.log("body error");
      return;
    }
    // 将bot回复内容加入消息列表
    const responseMessage: Message = await createOrUpdateMessage({
      id: "",
      role: "assistant",
      content: "",
      chatId: chatIdRef.current,
    });
    dispatch({
      type: ActionType.ADD_MESSAGE,
      message: responseMessage,
    });
    // 更新消息流id是否等于当前消息id用于判断是否添加输入光标
    dispatch({
      type: ActionType.UPDATE,
      field: "streamingId",
      value: responseMessage.id,
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let contentGenerating = "";
    while (!done) {
      if (stopRef.current) {
        stopRef.current = false;
        controller.abort(); // 当用户点击“停止生成”按钮时，中止请求
        break;
      }
      const result = await reader.read();
      done = result.done;
      const chunk = decoder.decode(result.value);
      contentGenerating += chunk;
      // 逐字更新bot消息，模拟生成过程
      dispatch({
        type: ActionType.UPDATE_MESSAGE,
        message: { ...responseMessage, content: contentGenerating },
      });
    }
    createOrUpdateMessage({ ...responseMessage, content: contentGenerating });
    dispatch({
      type: ActionType.UPDATE,
      field: "streamingId",
      value: "",
    });
  }

  return (
    <div
      className="absolute bottom-0 inset-x-0 bg-gradient-to-b from-[rgba(255,255,255,0)] from-[13.94%] to-[#fff] to-[54.73%] pt-10 dark:from-[rgba(53,55,64,0)] dark:to-[#353740] dark:to-[58.85%]
"
    >
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center px-4 space-y-4">
        {messageList.length != 0 &&
          (streamingId !== "" ? (
            <Button
              variant="primary"
              icon={PiStopBold}
              className="font-medium"
              onClick={() => {
                stopRef.current = true;
              }}
            >
              停止生成
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={MdRefresh}
              className="font-medium"
              onClick={() => resend()}
            >
              重新生成
            </Button>
          ))}

        <div className="flex items-end w-full border-black/10 dark:border-gray-800/50 bg-white dark:bg-gray-700 rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.1)] py-4">
          <div className="mx-3 mb-2.5">
            <PiLightningFill />
          </div>
          <TextareaAutosize
            className="outline-none flex-1 max-h-64 mb-1.5 bg-transparent text-black dark:text-white resize-none border-0"
            placeholder={`向${currentModel}发送消息...`}
            rows={1}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
          />
          <Button
            className="mx-3 !rounded-lg"
            icon={FiSend}
            disabled={messageText.trim() === "" || streamingId !== ""}
            variant="primary"
            onClick={send}
          />
        </div>
      </div>
      <footer className="text-center text-sm text-gray-500 dark:text-gray-300 px-4 pb-6">
        ©️{new Date().getFullYear()}&nbsp;{" "}
        <a
          className="font-medium py-[1px] border-b border-dotted border-black/60 hover:border-black/0 dark:border-gray-200 dark:hover:border-gray-200/0 animated-underline"
          href="https://echoyi.fun"
          target="_blank"
        >
          echoyi.fun
        </a>
        .&nbsp;forked from&nbsp;
        <a
          className="font-medium py-[1px] border-b border-dotted border-black/60 hover:border-black/0 dark:border-gray-200 dark:hover:border-gray-200/0 animated-underline"
          href="https://x.zhixing.co"
          target="_blank"
        >
          知行小课
        </a>
        .&nbsp;基于第三方提供的接口，仅供学习交流使用。
      </footer>
    </div>
  );
}
