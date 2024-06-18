<template>
  <router-link :to="'/'" class="logo">
    <h1>
      <div class="icon">
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M25.4125 24.7974C28.0363 25.9813 28.5811 29.7806 29.4621 31.5092C29.9004 32.3692 31.4874 33.0855 32.7771 32.7342M25.4125 24.7974C22.9294 23.677 21.5516 21.8748 17.8744 22.9281M25.4125 24.7974C23.5191 26.0831 19.3607 27.5091 17.8744 22.9281M17.8744 22.9281C17.666 22.9878 17.4502 23.0567 17.2264 23.1353C13.8884 24.3089 13.491 27.2009 13.8688 28.3447C15.9367 28.7506 19.2321 33.0255 18.6051 33.3078C17.0732 33.4832 13.543 32.5702 13.258 32.6985C12.5313 33.3684 10.4977 35.9154 10.4196 35.7586C10.1554 35.1717 10.0305 35.3511 9.25355 33.4729C8.47662 31.5947 9.76114 30.232 10.1572 29.4367C6.03449 19.3645 12.1979 13.3876 17.6454 11.0725C18.3203 10.9881 17.214 5.32516 17.2781 5.46766C19.6486 5.65737 21.6814 5.04465 24.9404 9.45712C36.124 10.2579 40.4909 19.6893 34.2856 27.4527C35.0787 30.9361 34.0795 32.3795 32.7771 32.7342M26.3223 23.4966C24.0602 23.6238 19.3828 22.8981 18.77 18.9786C18.6764 18.8722 18.762 18.6257 19.8531 18.4911C20.9441 18.3564 22.8766 18.1011 23.7065 17.9903M30.2743 24.6615C30.5444 26.9368 31.4232 31.7367 32.7771 32.7342"
            stroke="var(--main-color)" stroke-width="2" stroke-linecap="round" />
          <circle cx="30.4236" cy="20.2734" r="1.5" fill="var(--main-color)" />
        </svg>
      </div>

      <span class="logo__text">TypeMore</span>
    </h1>
  </router-link>
</template>
<script></script>
<style lang="scss" scoped>
//TODO: IDK WHY link TOOOO BIG (its problem becose user can miss click on logo!)
.logo {
  text-decoration: none;
  margin-right: 10px;
  display: flex;
  user-select: none;

  & .icon {
    display: flex;
  }

  &__text {
    @media screen and (max-width:539px) {
      display: none;
    }
  }

}

h1 {
  color: var(--text-color);
  font-family: 'Balsamiq Sans';
  transform: translateY(23%);
  position: relative;
  margin: 0;

  & .icon {
    position: absolute;
    transform: translate(50%, 50%);
    right: 50%;
    top: -50px;
  }
}

@media screen and (max-width: 539px) {
  h1 {
    transform: none;
  }

  .logo {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: 4px;

    & .icon {

      position: unset;
      transform: rotate(-60deg);
    }
  }

}
</style>
