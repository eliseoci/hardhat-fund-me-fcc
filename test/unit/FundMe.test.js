const { deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", async function () {
          let fundMe
          let deployer
          let mockV3Aggregator
          const sendValue = ethers.utils.parseEther("0.005") // converts eth to wei
          beforeEach(async function () {
              // const accounts = await ethers.getSigners()
              // const accountZero = accounts[0]
              await deployments.fixture(["all"])
              deployer = (await getNamedAccounts()).deployer
              fundMe = await ethers.getContract("FundMe", deployer)
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              )
          })

          describe("constructor", async function () {
              it("sets the aggregator addresses correctly", async function () {
                  const response = await fundMe.getPriceFeed()
                  assert.equal(response, mockV3Aggregator.address)
              })
          })

          describe("fund", async function () {
              it("fails if you don't send enough ETH", async function () {
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "Didn't send enough ETH"
                  )
              })
              it("updates the amount funded data structure", async function () {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  )
                  assert.equal(response.toString(), sendValue.toString())
              })
              it("adds funder to array of getFunder", async function () {
                  await fundMe.fund({ value: sendValue })
                  const funder = await fundMe.getFunder(0)
                  assert.equal(funder, deployer)
              })
          })

          describe("withdraw", async function () {
              beforeEach(async function () {
                  await fundMe.fund({ value: sendValue })
              })

              it("withdraw ETH from a single funder", async function () {
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)

                  assert.equal(endingFundMeBalance, 0)
                  assert.equal(
                      startingFundMeBalance.add(startingDeployerBalance),
                      endingDeployerBalance.add(gasCost).toString()
                  )
              })
              it("allow us to withdraw with multiple getFunder", async function () {
                  const accounts = await ethers.getSigners()
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })

                      const startingFundMeBalance =
                          await fundMe.provider.getBalance(fundMe.address)
                      const startingDeployerBalance =
                          await fundMe.provider.getBalance(deployer)
                      const transactionResponse = await fundMe.withdraw()
                      const transactionReceipt = await transactionResponse.wait(
                          1
                      )
                      const { gasUsed, effectiveGasPrice } = transactionReceipt
                      const gasCost = gasUsed.mul(effectiveGasPrice)
                      const endingFundMeBalance =
                          await fundMe.provider.getBalance(fundMe.address)
                      const endingDeployerBalance =
                          await fundMe.provider.getBalance(deployer)

                      assert.equal(endingFundMeBalance, 0)
                      assert.equal(
                          startingFundMeBalance.add(startingDeployerBalance),
                          endingDeployerBalance.add(gasCost).toString()
                      )
                      await expect(fundMe.getFunder(0)).to.be.reverted
                      for (i = 1; i < 6; i++) {
                          assert.equal(
                              await fundMe.getAddressToAmountFunded(
                                  accounts[i].address
                              ),
                              0
                          )
                      }
                  }
              })

              it("only allows the owner to withdraw", async function () {
                  const accounts = await ethers.getSigners()
                  const attacker = accounts[1]
                  const attackerConnectedContract = await fundMe.connect(
                      attacker
                  )
                  await expect(
                      attackerConnectedContract.withdraw()
                  ).to.be.revertedWith("FundMe__NotOwner")
              })

              it("allow us to cheaper withdraw with multiple getFunder", async function () {
                  const accounts = await ethers.getSigners()
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })

                      const startingFundMeBalance =
                          await fundMe.provider.getBalance(fundMe.address)
                      const startingDeployerBalance =
                          await fundMe.provider.getBalance(deployer)
                      const transactionResponse = await fundMe.cheaperWithdraw()
                      const transactionReceipt = await transactionResponse.wait(
                          1
                      )
                      const { gasUsed, effectiveGasPrice } = transactionReceipt
                      const gasCost = gasUsed.mul(effectiveGasPrice)
                      const endingFundMeBalance =
                          await fundMe.provider.getBalance(fundMe.address)
                      const endingDeployerBalance =
                          await fundMe.provider.getBalance(deployer)

                      assert.equal(endingFundMeBalance, 0)
                      assert.equal(
                          startingFundMeBalance.add(startingDeployerBalance),
                          endingDeployerBalance.add(gasCost).toString()
                      )
                      await expect(fundMe.getFunder(0)).to.be.reverted
                      for (i = 1; i < 6; i++) {
                          assert.equal(
                              await fundMe.getAddressToAmountFunded(
                                  accounts[i].address
                              ),
                              0
                          )
                      }
                  }
              })
          })
      })
