<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Check, X, CheckCircle2, AlertTriangle, Info } from "lucide-vue-next";
import { cn } from "@/lib/utils";

type AlertType = "success" | "error" | "warning" | "info";
type ConfirmVariant = "success" | "destructive";

const props = withDefaults(
  defineProps<{
    class?: string;
    message?: string;
    type?: AlertType;
    duration?: number;
    confirmMode?: boolean;
    confirmVariant?: ConfirmVariant;
    confirmText?: string;
    cancelText?: string;
  }>(),
  {
    class: "",
    message: "",
    type: "success",
    duration: 2000,
    confirmMode: false,
    confirmVariant: "success",
    confirmText: "확인",
    cancelText: "취소",
  }
);

const isDestructive = computed(() => props.confirmVariant === "destructive");

const emit = defineEmits<{
  (e: "close"): void;
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const isVisible = ref(true);
let timer: ReturnType<typeof setTimeout> | null = null;

const alertStyles = computed(() => {
  if (props.confirmMode) return "";
  // 토스트 배경은 타입과 무관하게 --primary고, 성공/에러 구분은 아이콘이 맡는다.
  // 그런데 error만 글자에 --destructive-foreground를 써서 배경과 짝이 어긋나 있었다.
  // 다크에서는 밝은 인디고 위 흰 글씨(2.81:1)가 되어 사실상 읽히지 않았다.
  // 배경에 맞는 짝으로 통일한다 — 라이트 5.07:1 / 다크 6.41:1.
  return "bg-primary text-primary-foreground";
});

const containerStyles = computed(() => {
  if (props.confirmMode) {
    return "bg-background border border-border rounded-2xl shadow-2xl pointer-events-auto w-[280px] sm:w-[320px] overflow-hidden";
  }
  return "rounded-2xl shadow-lg px-5 py-3 flex items-center gap-2 pointer-events-auto";
});

const onAfterLeave = (): void => emit("close");
const handleConfirm = (): void => {
  emit("confirm");
  isVisible.value = false;
};
const handleCancel = (): void => {
  emit("cancel");
  isVisible.value = false;
};

onMounted(() => {
  if (!props.confirmMode) {
    timer = setTimeout(() => { isVisible.value = false; }, props.duration);
  }
});

onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <Teleport to="body">
    <!-- Confirm 모드 배경 오버레이 -->
    <Transition
      v-if="confirmMode"
      appear
      appear-active-class="animate-in fade-in-0 duration-200"
      enter-active-class="animate-in fade-in-0 duration-200"
      leave-active-class="animate-out fade-out-0 duration-150"
    >
      <div v-if="isVisible" class="fixed inset-0 z-50 bg-black/50" @click="handleCancel" />
    </Transition>

    <div
      :class="[
        'fixed z-50 flex justify-center pointer-events-none',
        confirmMode
          ? 'inset-0 items-center pt-[10vh] sm:pt-0 sm:pb-[8vh]'
          : 'top-8 left-0 right-0',
      ]"
    >
      <Transition
        appear
        :appear-active-class="confirmMode
          ? 'animate-in fade-in-0 zoom-in-95 slide-in-from-top-4 sm:slide-in-from-bottom-0 duration-200'
          : 'animate-in fade-in-0 slide-in-from-top-5 duration-300'"
        :enter-active-class="confirmMode
          ? 'animate-in fade-in-0 zoom-in-95 slide-in-from-top-4 sm:slide-in-from-bottom-0 duration-200'
          : 'animate-in fade-in-0 slide-in-from-top-5 duration-300'"
        :leave-active-class="confirmMode
          ? 'animate-out fade-out-0 zoom-out-95 slide-out-to-top-4 sm:slide-out-to-bottom-0 duration-150'
          : 'animate-out fade-out-0 slide-out-to-top-5 duration-200'"
        @after-leave="onAfterLeave"
      >
        <div v-if="isVisible" :class="cn(containerStyles, alertStyles, props.class)" role="alert">
          <!-- Confirm 다이얼로그 -->
          <template v-if="confirmMode">
            <div class="pt-6 pb-4 px-5 sm:pt-6 sm:pb-4 sm:px-6 flex flex-col items-center gap-2.5">
              <div v-if="!isDestructive" class="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/5 flex items-center justify-center">
                <CheckCircle2 class="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <div v-else class="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/5 flex items-center justify-center">
                <AlertTriangle class="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <p class="text-caption sm:text-body font-medium text-foreground text-center whitespace-pre-line">
                {{ message }}
              </p>
            </div>
            <div class="flex border-t border-border">
              <button
                @click="handleCancel"
                class="flex-1 py-3 sm:py-3.5 text-caption sm:text-body font-medium text-muted-foreground hover:bg-muted/50 transition-colors border-r border-border"
              >
                {{ cancelText }}
              </button>
              <button
                @click="handleConfirm"
                class="flex-1 py-3 sm:py-3.5 text-caption sm:text-body font-semibold transition-colors text-primary hover:bg-primary/5"
              >
                {{ confirmText }}
              </button>
            </div>
          </template>

          <!-- Toast 알림 -->
          <template v-else>
            <slot>
              <Check v-if="type === 'success'" class="w-4 h-4" />
              <AlertTriangle v-else-if="type === 'warning'" class="w-4 h-4" />
              <Info v-else-if="type === 'info'" class="w-4 h-4" />
              <X v-else class="w-4 h-4" />
              <p class="text-body font-medium">{{ message }}</p>
            </slot>
          </template>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
