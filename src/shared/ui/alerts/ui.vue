<template>
  <div class="alert-box">
    <div class="alert alert--error">
      <div class="alert__header header-alert">
        <Icon width="30" color="white" icon="pajamas:error" />
        <p class="header-alert__text">Error</p>
      </div>
      <div class="alert__body">
        Some error explain what heppend in DOM
      </div>
    </div>
    <div class="alert alert--info">
      <div class="alert__header header-alert">
        <Icon width="30" color="white" icon="pajamas:information-o" />
        <p class="header-alert__text">Information</p>
      </div>
      <div class="alert__body">
        Some error explain what heppend in DOM
      </div>
    </div>
    <div class="alert alert--success">
      <div class="alert__header header-alert">
        <Icon width="30" color="white" icon="pajamas:check-circle" />
        <p class="header-alert__text">Success</p>
      </div>
      <div class="alert__body">
        Some error explain what heppend in DOM
      </div>
    </div>
    <div class="alert alert--warn">
      <div class="alert__header header-alert">
        <Icon width="30" color="white" icon="pajamas:warning" />
        <p class="header-alert__text">Warning</p>
      </div>
      <div class="alert__body">
        Some error explain what heppend in DOM
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
//TODO: implement alert component
import { Icon } from '@iconify/vue';

</script>

<style lang="scss" scoped>
.alert-box {
  position: fixed;
  top: 12px;
  right: 0;
  z-index: var(--alert-z);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-alert {
  font-size: 18px;
}

.alert {
  --warn: #fc9403;
  --error: #d32f2f;
  --success: #1aaa55;
  --info: #1f78d1;
  padding: 14px;
  color: #FFFFFF;
  border-radius: var(--border-radius);


  &--warn {
    background-color: var(--warn);
  }

  &--error {
    background-color: var(--error);
  }

  &--info {
    background-color: var(--info);
  }

  &--success {
    background-color: var(--success);
  }

  &__header {
    color: #ffffff;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
}
</style>
